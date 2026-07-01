import { describe, it } from 'mocha'
import { expect } from 'chai'
import { lzmaWasmCompress, lzmaWasmDecompress } from '../../../icc-x-api/utils/lzma-wasm'
import { compressData, decompressData } from '../../../icc-x-api/utils/compression-utils'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const REF_SIZE = 32 * 1024

function generateReferenceData(): Uint8Array {
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
  return new TextEncoder().encode(lines.join('').slice(0, REF_SIZE))
}

function hasXzCli(): boolean {
  try {
    execFileSync('xz', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function xzCompress(data: Buffer): Buffer {
  const tmpIn = path.join(os.tmpdir(), `lzma-compat-ref-${Date.now()}.bin`)
  fs.writeFileSync(tmpIn, data)
  try {
    return execFileSync('xz', ['--compress', '-6', '--stdout', tmpIn])
  } finally {
    fs.unlinkSync(tmpIn)
  }
}

function xzDecompress(data: Buffer): Buffer | null {
  const tmpIn = path.join(os.tmpdir(), `lzma-compat-dec-${Date.now()}.bin`)
  fs.writeFileSync(tmpIn, data)
  try {
    return execFileSync('xz', ['--decompress', '--format=auto', '--stdout', tmpIn])
  } catch {
    return null
  } finally {
    fs.unlinkSync(tmpIn)
  }
}

describe('LZMA WASM compatibility (Node.js)', function () {
  this.timeout(60_000)

  describe('round-trip', () => {
    it('should compress and decompress correctly via lzmaWasm functions', async () => {
      const data = generateReferenceData()
      const compressed = await lzmaWasmCompress(data)
      const decompressed = new Uint8Array(await lzmaWasmDecompress(compressed))

      expect(decompressed.length).to.equal(data.length)
      expect(decompressed.every((v, i) => v === data[i])).to.be.true
    })

    it('should compress and decompress correctly via compressData/decompressData', async () => {
      const data = generateReferenceData()
      const { data: compressed, algorithm } = await compressData(data)

      expect(algorithm).to.equal('lzma2')
      expect(compressed.byteLength).to.be.lessThan(data.length)

      const decompressed = new Uint8Array(await decompressData(compressed, algorithm))
      expect(decompressed.length).to.equal(data.length)
      expect(decompressed.every((v, i) => v === data[i])).to.be.true
    })

    it('should skip compression for small payloads', async () => {
      const small = new Uint8Array(32)
      const { data: result, algorithm } = await compressData(small)

      expect(algorithm).to.be.undefined
      expect(new Uint8Array(result)).to.deep.equal(small)
    })

    it('should skip compression for already-compressed UTIs', async () => {
      const data = generateReferenceData()
      const { algorithm } = await compressData(data, ['public.jpeg'])

      expect(algorithm).to.be.undefined
    })

    it('should return data as-is when decompressing with undefined algorithm', async () => {
      const data = generateReferenceData()
      const result = new Uint8Array(await decompressData(data, undefined))

      expect(result.length).to.equal(data.length)
      expect(result.every((v, i) => v === data[i])).to.be.true
    })

    it('should throw for unsupported algorithm', async () => {
      try {
        await decompressData(new Uint8Array(10), 'unknown')
        expect.fail('should have thrown')
      } catch (e: any) {
        expect(e.message).to.include('Unsupported compression algorithm')
      }
    })
  })

  describe('input immutability', () => {
    it('should not modify an ArrayBuffer input in place when compressing via lzmaWasmCompress', async () => {
      const data = generateReferenceData()
      const input = data.buffer.slice(0) as ArrayBuffer
      const snapshot = new Uint8Array(input.slice(0))

      await lzmaWasmCompress(input)

      expect(new Uint8Array(input)).to.deep.equal(snapshot)
    })

    it('should not modify an ArrayBuffer input in place when decompressing via lzmaWasmDecompress', async () => {
      const data = generateReferenceData()
      const compressed = await lzmaWasmCompress(data)
      const snapshot = new Uint8Array(compressed.slice(0))

      await lzmaWasmDecompress(compressed)

      expect(new Uint8Array(compressed)).to.deep.equal(snapshot)
    })

    it('should not modify an ArrayBuffer input in place when compressing via compressData', async () => {
      const data = generateReferenceData()
      const input = data.buffer.slice(0) as ArrayBuffer
      const snapshot = new Uint8Array(input.slice(0))

      await compressData(input)

      expect(new Uint8Array(input)).to.deep.equal(snapshot)
    })

    it('should not modify an ArrayBuffer input in place when decompressing via decompressData', async () => {
      const data = generateReferenceData()
      const { data: compressed, algorithm } = await compressData(data)
      const snapshot = new Uint8Array(compressed.slice(0))

      await decompressData(compressed, algorithm)

      expect(new Uint8Array(compressed)).to.deep.equal(snapshot)
    })
  })

  describe('xz CLI interop', function () {
    before(function () {
      if (!hasXzCli()) this.skip()
    })

    it('should produce output that xz CLI can decompress', async () => {
      const data = generateReferenceData()
      const compressed = await lzmaWasmCompress(data)

      const decompressed = xzDecompress(Buffer.from(compressed))
      expect(decompressed).to.not.be.null
      expect(decompressed!.length).to.equal(data.length)
      expect(decompressed!.equals(Buffer.from(data))).to.be.true
    })

    it('should decompress output from xz CLI', async () => {
      const data = generateReferenceData()
      const xzCompressed = xzCompress(Buffer.from(data))

      const decompressed = new Uint8Array(await lzmaWasmDecompress(xzCompressed))
      expect(decompressed.length).to.equal(data.length)
      expect(decompressed.every((v, i) => v === data[i])).to.be.true
    })

    it('should print compatibility matrix', async () => {
      const data = generateReferenceData()

      const wasmCompressed = await lzmaWasmCompress(data)
      const xzCompressed = xzCompress(Buffer.from(data))

      type Result = { success: boolean; matches: boolean }
      const matrix: { [producer: string]: { [consumer: string]: Result } } = {
        'LZMA-WASM': { 'LZMA-WASM': { success: false, matches: false }, 'xz CLI': { success: false, matches: false } },
        'xz CLI': { 'LZMA-WASM': { success: false, matches: false }, 'xz CLI': { success: false, matches: false } },
      }

      // WASM → WASM
      try {
        const d = new Uint8Array(await lzmaWasmDecompress(wasmCompressed))
        matrix['LZMA-WASM']['LZMA-WASM'] = { success: true, matches: d.every((v, i) => v === data[i]) }
      } catch {
        /* leave as false */
      }

      // WASM → xz CLI
      const d1 = xzDecompress(Buffer.from(wasmCompressed))
      if (d1) matrix['LZMA-WASM']['xz CLI'] = { success: true, matches: d1.equals(Buffer.from(data)) }

      // xz CLI → WASM
      try {
        const d = new Uint8Array(await lzmaWasmDecompress(xzCompressed))
        matrix['xz CLI']['LZMA-WASM'] = { success: true, matches: d.every((v, i) => v === data[i]) }
      } catch {
        /* leave as false */
      }

      // xz CLI → xz CLI
      const d2 = xzDecompress(Buffer.from(xzCompressed))
      if (d2) matrix['xz CLI']['xz CLI'] = { success: true, matches: d2.equals(Buffer.from(data)) }

      // Print
      const producers = ['LZMA-WASM', 'xz CLI']
      console.log('\n      Compatibility Matrix (32 KB):')
      console.log(`      ${'Compressed by'.padEnd(16)} | ${'LZMA-WASM'.padEnd(12)} | ${'xz CLI'.padEnd(12)}`)
      console.log(`      ${'─'.repeat(46)}`)
      for (const p of producers) {
        const cells = producers.map((c) => {
          const r = matrix[p][c]
          return r.success && r.matches ? 'OK' : r.success ? 'MISMATCH' : 'FAIL'
        })
        console.log(`      ${p.padEnd(16)} | ${cells[0].padEnd(12)} | ${cells[1].padEnd(12)}`)
      }
      console.log(`\n      WASM compressed: ${wasmCompressed.byteLength} bytes (${((wasmCompressed.byteLength / REF_SIZE) * 100).toFixed(1)}%)`)
      console.log(`      xz compressed:  ${xzCompressed.length} bytes (${((xzCompressed.length / REF_SIZE) * 100).toFixed(1)}%)`)

      // All cells must pass
      for (const p of producers) {
        for (const c of producers) {
          expect(matrix[p][c].success, `${p} → ${c} decompression failed`).to.be.true
          expect(matrix[p][c].matches, `${p} → ${c} data mismatch`).to.be.true
        }
      }
    })
  })
})
