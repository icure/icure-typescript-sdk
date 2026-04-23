import { test, expect } from '@playwright/test'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const REF_SIZE = 32 * 1024

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
}

function startServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split('?')[0] || '/'
      const filePath = path.join(PROJECT_ROOT, urlPath)

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const ext = path.extname(filePath)
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      })
      fs.createReadStream(filePath).pipe(res)
    })

    server.listen(0, () => {
      const addr = server.address()
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 })
    })
  })
}

function generateReferenceData(): Buffer {
  const words = ['patient', 'contact', 'healthcare', 'delegation', 'encrypted', 'document', 'service', 'invoice']
  const lines: string[] = []
  let len = 0
  let i = 0
  while (len < REF_SIZE) {
    const line = `${i}: ${words[i % words.length]} id=${Math.random().toString(36).slice(2)} ts=${Date.now()} value=${Math.random()}\n`
    lines.push(line)
    len += line.length
    i++
  }
  return Buffer.from(lines.join('').slice(0, REF_SIZE), 'utf-8')
}

function xzCompress(data: Buffer): Buffer {
  const tmpIn = path.join(require('os').tmpdir(), `lzma-compat-ref-${Date.now()}.bin`)
  fs.writeFileSync(tmpIn, data)
  try {
    return execFileSync('xz', ['--compress', '-6', '--stdout', tmpIn])
  } finally {
    fs.unlinkSync(tmpIn)
  }
}

function xzDecompress(data: Buffer, format: string = 'auto'): Buffer | null {
  const tmpIn = path.join(require('os').tmpdir(), `lzma-compat-dec-${Date.now()}.bin`)
  fs.writeFileSync(tmpIn, data)
  try {
    return execFileSync('xz', ['--decompress', `--format=${format}`, '--stdout', tmpIn])
  } catch {
    return null
  } finally {
    fs.unlinkSync(tmpIn)
  }
}

type Producer = 'LZMA-JS' | 'LZMA-WASM' | 'xz CLI'
type MatrixCell = { success: boolean; error?: string; matchesOriginal: boolean }
type Matrix = Record<Producer, Record<Producer, MatrixCell>>

test('Compression compatibility matrix', async ({ page }) => {
  test.setTimeout(60_000)

  const { server, port } = await startServer()

  try {
    await page.goto(`http://localhost:${port}/test/benchmarks/lzma-compat.html`)
    await page.waitForFunction(() => (window as any).__ready === true, null, { timeout: 30_000 })

    // Generate reference data
    const refData = generateReferenceData()
    const refArray = Array.from(refData)

    // --- Compress with all three producers ---

    // LZMA-JS (LZMA1 .lzma format)
    const lzmaJsCompressed: number[] = await page.evaluate(async (data) => {
      return await (window as any).lzmaJsCompress(new Uint8Array(data))
    }, refArray)

    // LZMA-WASM (LZMA2 .xz format)
    const lzmaWasmCompressed: number[] = await page.evaluate((data) => {
      return (window as any).lzmaWasmCompress(data)
    }, refArray)

    // xz CLI (.xz format)
    const xzCompressed = xzCompress(refData)

    const compressed: Record<Producer, { data: number[]; size: number }> = {
      'LZMA-JS': { data: lzmaJsCompressed, size: lzmaJsCompressed.length },
      'LZMA-WASM': { data: lzmaWasmCompressed, size: lzmaWasmCompressed.length },
      'xz CLI': { data: Array.from(xzCompressed), size: xzCompressed.length },
    }

    // --- Try all 9 decompression combinations ---

    const producers: Producer[] = ['LZMA-JS', 'LZMA-WASM', 'xz CLI']
    const matrix: Matrix = {} as Matrix

    for (const producer of producers) {
      matrix[producer] = {} as Record<Producer, MatrixCell>
      const compData = compressed[producer].data

      // Decompress with LZMA-JS
      try {
        const result: number[] = await page.evaluate(async (data) => {
          return await (window as any).lzmaJsDecompress(data)
        }, compData)
        const matches = result.length === refArray.length && result.every((v, i) => v === refArray[i])
        matrix[producer]['LZMA-JS'] = { success: true, matchesOriginal: matches }
      } catch (e: any) {
        matrix[producer]['LZMA-JS'] = { success: false, error: e.message, matchesOriginal: false }
      }

      // Decompress with LZMA-WASM
      try {
        const result: number[] = await page.evaluate((data) => {
          return (window as any).lzmaWasmDecompress(data)
        }, compData)
        const matches = result.length === refArray.length && result.every((v, i) => v === refArray[i])
        matrix[producer]['LZMA-WASM'] = { success: true, matchesOriginal: matches }
      } catch (e: any) {
        matrix[producer]['LZMA-WASM'] = { success: false, error: e.message, matchesOriginal: false }
      }

      // Decompress with xz CLI
      const xzResult = xzDecompress(Buffer.from(compData), 'auto')
      if (xzResult) {
        const matches = xzResult.length === refData.length && xzResult.equals(refData)
        matrix[producer]['xz CLI'] = { success: true, matchesOriginal: matches }
      } else {
        matrix[producer]['xz CLI'] = { success: false, error: 'xz exited with error', matchesOriginal: false }
      }
    }

    // --- Print the matrix ---
    const W = 90
    console.log('\n' + '='.repeat(W))
    console.log('Compression Compatibility Matrix (32 KB reference file)')
    console.log('Rows = compressed by, Columns = decompressed by')
    console.log('='.repeat(W))

    // Header
    console.log(
      `  ${'Compressed by'.padEnd(16)} | ${'LZMA-JS'.padEnd(20)} | ${'LZMA-WASM'.padEnd(20)} | ${'xz CLI'.padEnd(20)}`
    )
    console.log('  ' + '-'.repeat(W - 2))

    for (const producer of producers) {
      const cells = producers.map((decompressor) => {
        const cell = matrix[producer][decompressor]
        if (cell.success && cell.matchesOriginal) return 'OK'
        if (cell.success && !cell.matchesOriginal) return 'MISMATCH'
        return 'FAIL'
      })
      console.log(
        `  ${producer.padEnd(16)} | ${cells[0].padEnd(20)} | ${cells[1].padEnd(20)} | ${cells[2].padEnd(20)}`
      )
    }

    console.log('  ' + '-'.repeat(W - 2))

    // Print compressed sizes
    console.log('\n  Compressed sizes:')
    for (const producer of producers) {
      const c = compressed[producer]
      const ratio = ((c.size / REF_SIZE) * 100).toFixed(1)
      console.log(`    ${producer.padEnd(16)}: ${c.size} bytes (${ratio}%)`)
    }

    console.log('\n' + '='.repeat(W))

    // --- Assertions: at minimum, each impl can decompress its own output ---
    for (const impl of producers) {
      expect(matrix[impl][impl].success).toBe(true)
      expect(matrix[impl][impl].matchesOriginal).toBe(true)
    }
  } finally {
    server.close()
  }
})