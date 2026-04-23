import { describe, it } from 'mocha'
import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'
import { lzmaWasmCompress, lzmaWasmDecompress } from '../../../icc-x-api/utils/lzma-wasm'

function generateData(size: number): Uint8Array {
  const words = ['patient', 'contact', 'healthcare', 'delegation', 'encrypted', 'document', 'service', 'invoice']
  const lines: string[] = []
  let len = 0
  let i = 0
  while (len < size) {
    const line = `${i}: ${words[i % words.length]} id=${Math.random().toString(36).slice(2)} ts=${Date.now()} value=${Math.random()}\n`
    lines.push(line)
    len += line.length
    i++
  }
  return new TextEncoder().encode(lines.join('').slice(0, size))
}

interface Stats {
  median: number
  mean: number
  min: number
  max: number
  p95: number
}

function computeStats(timings: number[]): Stats {
  const sorted = [...timings].sort((a, b) => a - b)
  const n = sorted.length
  return {
    median: sorted[Math.floor(n / 2)],
    mean: timings.reduce((a, b) => a + b, 0) / n,
    min: sorted[0],
    max: sorted[n - 1],
    p95: sorted[Math.floor(n * 0.95)],
  }
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + ' s'
  return ms.toFixed(2) + ' ms'
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s
}

const SIZES = [
  { label: '1 KB', bytes: 1024, iterations: 5 },
  { label: '32 KB', bytes: 32 * 1024, iterations: 5 },
  { label: '256 KB', bytes: 256 * 1024, iterations: 5 },
  { label: '128 MB', bytes: 128 * 1024 * 1024, iterations: 2 },
]

describe('LZMA WASM benchmark (Node.js)', function () {
  this.timeout(600_000)

  for (const { label, bytes, iterations } of SIZES) {
    it(`should compress and decompress ${label} payload`, async () => {
      const data = generateData(bytes)
      const compressTimings: number[] = []
      const decompressTimings: number[] = []
      let compressed!: ArrayBuffer
      let correct = false

      // Warmup
      compressed = await lzmaWasmCompress(data)
      await lzmaWasmDecompress(compressed)

      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now()
        compressed = await lzmaWasmCompress(data)
        compressTimings.push(performance.now() - t0)

        const t1 = performance.now()
        const decompressed = await lzmaWasmDecompress(compressed)
        decompressTimings.push(performance.now() - t1)

        const roundTripped = new Uint8Array(decompressed)
        if (i === 0) {
          correct = roundTripped.length === data.length && roundTripped.every((v, j) => v === data[j])
        }
      }

      const compStats = computeStats(compressTimings)
      const decStats = computeStats(decompressTimings)
      const ratio = ((compressed.byteLength / bytes) * 100).toFixed(1)

      console.log(`\n    ${label} (${bytes.toLocaleString()} bytes):`)
      console.log(`      ${'Operation'.padEnd(14)} ${pad('Median', 12)} ${pad('Mean', 12)} ${pad('Min', 12)} ${pad('Max', 12)} ${pad('P95', 12)}`)
      console.log(`      ${'─'.repeat(74)}`)
      console.log(
        `      ${'Compress'.padEnd(14)} ${pad(fmtMs(compStats.median), 12)} ${pad(fmtMs(compStats.mean), 12)} ${pad(fmtMs(compStats.min), 12)} ${pad(fmtMs(compStats.max), 12)} ${pad(fmtMs(compStats.p95), 12)}`
      )
      console.log(
        `      ${'Decompress'.padEnd(14)} ${pad(fmtMs(decStats.median), 12)} ${pad(fmtMs(decStats.mean), 12)} ${pad(fmtMs(decStats.min), 12)} ${pad(fmtMs(decStats.max), 12)} ${pad(fmtMs(decStats.p95), 12)}`
      )
      console.log(`      Compressed: ${compressed.byteLength.toLocaleString()} bytes (${ratio}%)`)
      console.log(`      Round-trip: ${correct ? 'OK' : 'FAIL'}`)

      expect(correct).to.be.true
      expect(compressed.byteLength).to.be.lessThan(bytes)
    })
  }

  it('should compress and decompress 100mb.json from disk (WASM only)', async function () {
    const filePath = path.resolve(__dirname, '..', '..', 'benchmarks', '100mb.json')
    if (!fs.existsSync(filePath)) return this.skip()

    const data = new Uint8Array(fs.readFileSync(filePath))
    const fileSize = data.length
    const iterations = 2

    const compressTimings: number[] = []
    const decompressTimings: number[] = []
    let compressed!: ArrayBuffer
    let correct = false

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now()
      compressed = await lzmaWasmCompress(data)
      compressTimings.push(performance.now() - t0)

      const t1 = performance.now()
      const decompressed = await lzmaWasmDecompress(compressed)
      decompressTimings.push(performance.now() - t1)

      if (i === 0) {
        const roundTripped = new Uint8Array(decompressed)
        correct = roundTripped.length === data.length && roundTripped.every((v, j) => v === data[j])
      }
    }

    const compStats = computeStats(compressTimings)
    const decStats = computeStats(decompressTimings)
    const ratio = ((compressed.byteLength / fileSize) * 100).toFixed(1)

    console.log(`\n    100mb.json (${fileSize.toLocaleString()} bytes):`)
    console.log(`      ${'Operation'.padEnd(14)} ${pad('Median', 12)} ${pad('Mean', 12)} ${pad('Min', 12)} ${pad('Max', 12)} ${pad('P95', 12)}`)
    console.log(`      ${'─'.repeat(74)}`)
    console.log(
      `      ${'Compress'.padEnd(14)} ${pad(fmtMs(compStats.median), 12)} ${pad(fmtMs(compStats.mean), 12)} ${pad(fmtMs(compStats.min), 12)} ${pad(fmtMs(compStats.max), 12)} ${pad(fmtMs(compStats.p95), 12)}`
    )
    console.log(
      `      ${'Decompress'.padEnd(14)} ${pad(fmtMs(decStats.median), 12)} ${pad(fmtMs(decStats.mean), 12)} ${pad(fmtMs(decStats.min), 12)} ${pad(fmtMs(decStats.max), 12)} ${pad(fmtMs(decStats.p95), 12)}`
    )
    console.log(`      Compressed: ${compressed.byteLength.toLocaleString()} bytes (${ratio}%)`)
    console.log(`      Round-trip: ${correct ? 'OK' : 'FAIL'}`)

    expect(correct).to.be.true
    expect(compressed.byteLength).to.be.lessThan(fileSize)
  })
})
