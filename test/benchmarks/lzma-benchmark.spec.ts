import { test, expect } from '@playwright/test'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
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
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      })
      fs.createReadStream(filePath).pipe(res)
    })

    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ server, port })
    })
  })
}

interface Stats {
  median: number
  mean: number
  min: number
  max: number
  p95: number
}

interface ImplResult {
  compress: Stats
  decompress: Stats
  compressedSize: number
  ratio: string
  correct: boolean
}

interface BenchmarkResult {
  size: string
  tag: string
  originalBytes: number
  files: {
    reference: string // base64
    lzmaJs: string // base64
    lzmaWasm: string // base64
  }
  jsInline: ImplResult
  jsWorker: ImplResult
  wasm: ImplResult
}

const IMPLS = ['jsInline', 'jsWorker', 'wasm'] as const
const IMPL_LABELS: Record<string, string> = {
  jsInline: 'JS Inline (LZMA1)',
  jsWorker: 'JS Worker (LZMA1)',
  wasm: 'WASM (LZMA2/XZ)',
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + ' s'
  return ms.toFixed(2) + ' ms'
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s
}

const WORKER_FILES_DIR = path.join(__dirname, 'worker-files')

test('LZMA benchmark: JS Inline vs JS Worker vs WASM', async ({ page }) => {
  test.setTimeout(1_800_000) // 30 minutes for 10MB payloads

  const { server, port } = await startServer()

  try {
    await page.goto(`http://localhost:${port}/test/benchmarks/lzma-benchmark.html`)

    await page.waitForFunction(() => (window as any).__benchmarkResults != null, null, { timeout: 1_500_000 })

    const results: BenchmarkResult[] = await page.evaluate(() => (window as any).__benchmarkResults)

    // Save test files to worker-files directory
    fs.mkdirSync(WORKER_FILES_DIR, { recursive: true })
    for (const r of results) {
      fs.writeFileSync(path.join(WORKER_FILES_DIR, `${r.tag}.bin`), Buffer.from(r.files.reference, 'base64'))
      fs.writeFileSync(path.join(WORKER_FILES_DIR, `${r.tag}.lzma`), Buffer.from(r.files.lzmaJs, 'base64'))
      fs.writeFileSync(path.join(WORKER_FILES_DIR, `${r.tag}.xz`), Buffer.from(r.files.lzmaWasm, 'base64'))
      console.log(`Saved ${r.tag}.bin, ${r.tag}.lzma, ${r.tag}.xz to ${WORKER_FILES_DIR}`)
    }

    // Print results
    const W = 130
    console.log('\n' + '='.repeat(W))
    console.log('LZMA Benchmark: JS Inline vs JS Worker vs WASM')
    console.log('='.repeat(W))

    for (const r of results) {
      console.log(`\n--- ${r.size} (${r.originalBytes.toLocaleString()} bytes) ---\n`)

      for (const op of ['compress', 'decompress'] as const) {
        console.log(`  ${op.toUpperCase()}:`)
        console.log(
          `    ${'Implementation'.padEnd(22)} ${pad('Median', 12)} ${pad('Mean', 12)} ${pad('Min', 12)} ${pad('Max', 12)} ${pad('P95', 12)} ${pad('Size', 10)} ${pad('Ratio', 8)} ${pad('OK', 4)}`
        )
        console.log('    ' + '-'.repeat(W - 4))

        const medians = IMPLS.map((impl) => r[impl][op].median)
        const fastestMedian = Math.min(...medians)

        for (const impl of IMPLS) {
          const s = r[impl][op]
          const isFastest = s.median === fastestMedian
          const marker = isFastest ? ' *' : '  '
          const compSize = op === 'compress' ? String(r[impl].compressedSize) : '-'
          const ratio = op === 'compress' ? r[impl].ratio + '%' : '-'
          console.log(
            `  ${marker}${IMPL_LABELS[impl].padEnd(22)} ${pad(fmtMs(s.median), 12)} ${pad(fmtMs(s.mean), 12)} ${pad(fmtMs(s.min), 12)} ${pad(fmtMs(s.max), 12)} ${pad(fmtMs(s.p95), 12)} ${pad(compSize, 10)} ${pad(ratio, 8)} ${pad(r[impl].correct ? 'OK' : 'FAIL', 4)}`
          )
        }

        // Speedup summary
        const jsInlineMs = r.jsInline[op].median
        const jsWorkerMs = r.jsWorker[op].median
        const wasmMs = r.wasm[op].median

        console.log('')
        console.log(`    Speedup vs JS Inline:  Worker ${(jsInlineMs / jsWorkerMs).toFixed(1)}x | WASM ${(jsInlineMs / wasmMs).toFixed(1)}x`)
        console.log(`    Speedup vs JS Worker:  WASM ${(jsWorkerMs / wasmMs).toFixed(1)}x`)
        console.log('')
      }
    }

    console.log('='.repeat(W))
    console.log('* = fastest for that operation/size')
    console.log('='.repeat(W))

    // Assertions
    for (const r of results) {
      expect(r.jsInline.correct).toBe(true)
      expect(r.jsWorker.correct).toBe(true)
      expect(r.wasm.correct).toBe(true)
    }
  } finally {
    server.close()
  }
})