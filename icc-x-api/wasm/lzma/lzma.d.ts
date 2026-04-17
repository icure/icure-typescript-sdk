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

declare function createLzmaModule(): Promise<LzmaWasmModule>
export default createLzmaModule
