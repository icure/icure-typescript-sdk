/**
 * WASM-based LZMA2/XZ compression using liblzma compiled via Emscripten.
 * The WASM module is lazy-loaded on first use.
 */

interface LzmaWasmModule {
  _lzma_wasm_compress(ptr: number, len: number, preset: number): number
  _lzma_wasm_decompress(ptr: number, len: number): number
  _get_result_ptr(): number
  _get_result_len(): number
  _free_result(): void
  _malloc(size: number): number
  _free(ptr: number): void
  HEAPU8: Uint8Array
}

type ModuleFactory = () => Promise<LzmaWasmModule>

let modulePromise: Promise<LzmaWasmModule> | null = null

function getModule(): Promise<LzmaWasmModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Dynamic import of the Emscripten glue code
      const factory: ModuleFactory = (await import('../wasm/lzma/lzma.js')).default
      return factory()
    })()
  }
  return modulePromise
}

export async function lzmaWasmCompress(data: ArrayBuffer | Uint8Array, preset: number = 6): Promise<ArrayBuffer> {
  const mod = await getModule()
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data

  const inputPtr = mod._malloc(input.length)
  if (!inputPtr) throw new Error('WASM malloc failed for input')

  try {
    mod.HEAPU8.set(input, inputPtr)
    const ret = mod._lzma_wasm_compress(inputPtr, input.length, preset)
    if (ret !== 0) {
      mod._free_result()
      throw new Error(`LZMA WASM compress failed with code ${ret}`)
    }

    const resultPtr = mod._get_result_ptr()
    const resultLen = mod._get_result_len()
    const output = new Uint8Array(resultLen)
    output.set(mod.HEAPU8.subarray(resultPtr, resultPtr + resultLen))
    mod._free_result()
    return output.buffer
  } finally {
    mod._free(inputPtr)
  }
}

export async function lzmaWasmDecompress(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const mod = await getModule()
  const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data

  const inputPtr = mod._malloc(input.length)
  if (!inputPtr) throw new Error('WASM malloc failed for input')

  try {
    mod.HEAPU8.set(input, inputPtr)
    const ret = mod._lzma_wasm_decompress(inputPtr, input.length)
    if (ret !== 0) {
      mod._free_result()
      throw new Error(`LZMA WASM decompress failed with code ${ret}`)
    }

    const resultPtr = mod._get_result_ptr()
    const resultLen = mod._get_result_len()
    const output = new Uint8Array(resultLen)
    output.set(mod.HEAPU8.subarray(resultPtr, resultPtr + resultLen))
    mod._free_result()
    return output.buffer
  } finally {
    mod._free(inputPtr)
  }
}