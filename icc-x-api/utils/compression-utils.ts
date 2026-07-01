import { lzmaWasmCompress, lzmaWasmDecompress } from './lzma-wasm'
import { ua2ab } from './binary-utils'

const COMPRESSION_VERSION = '1'
const MINIMUM_SIZE_FOR_COMPRESSION = 64

/** UTIs for formats that are already compressed and won't benefit from additional compression. */
const ALREADY_COMPRESSED_UTIS = new Set([
  // Images
  'public.jpeg',
  'public.jpeg2000',
  'public.png',
  'com.compuserve.gif',
  'com.microsoft.bmp', // low entropy but compression marginal vs overhead
  // Video
  'public.mpeg',
  'public.mpeg4',
  'public.mpegts',
  'com.apple.quicktime-movie',
  // Audio
  'public.mpeg4-audio',
  'public.mp3',
  // Archives / compressed formats
  'com.pkware.zip-archive',
  'org.gnu.gnu-zip-archive',
  'org.bzip.bzip2-archive',
  'com.rarlab.rar-archive',
  'com.allume.stuffit-archive',
  'org.7-zip.7-zip-archive',
  'public.tar-archive',
  'org.gnu.gnu-tar-archive',
  // Legacy UTI variants (pre-v1.0.117 camelCase format)
  'com.pkware.zipArchive',
  'org.gnu.gnuZipArchive',
  'org.bzip.bzip2Archive',
  'com.rarlab.rarArchive',
  'com.allume.stuffitArchive',
  'org.gnu.gnuTarArchive',
  'public.mpeg4Audio',
  'com.apple.quicktimeMovie',
])

export interface CompressionResult {
  data: ArrayBuffer
  algorithm: string | undefined
}

/**
 * Returns the current compression algorithms version string.
 * This version is bumped whenever the set of tried algorithms changes.
 */
export function getCompressionVersion(): string {
  return COMPRESSION_VERSION
}

/**
 * Attempts to compress the given data using available compression algorithms, picking the best result.
 * If any of the provided UTIs indicates the data is already in a compressed format (jpeg, png, zip, ...),
 * compression is skipped entirely.
 *
 * @param data the raw data to compress.
 * @param utis optional UTIs describing the data format; used to skip compression for already-compressed formats.
 * @returns the (possibly compressed) data and the algorithm used, or undefined if no compression was applied.
 */
export async function compressData(data: ArrayBuffer | Uint8Array, utis?: string[]): Promise<CompressionResult> {
  const raw = ua2ab(data)

  if (utis?.some((uti) => ALREADY_COMPRESSED_UTIS.has(uti)) || raw.byteLength < MINIMUM_SIZE_FOR_COMPRESSION) {
    return { data: raw, algorithm: undefined }
  }

  const compressed = await lzmaWasmCompress(data)
  if (compressed.byteLength < raw.byteLength) {
    return { data: compressed, algorithm: 'lzma2' }
  }
  return { data: raw, algorithm: undefined }
}

/**
 * Decompresses data that was compressed using one of the supported algorithms.
 *
 * @param data the compressed data.
 * @param algorithm the compression algorithm that was used (e.g. 'lzma'). If undefined, returns the data as-is.
 * @returns the decompressed data.
 * @throws if the algorithm is not supported or decompression fails.
 */
export async function decompressData(data: ArrayBuffer | Uint8Array, algorithm: string | undefined): Promise<ArrayBuffer> {
  if (!algorithm) {
    return ua2ab(data)
  }
  if (algorithm === 'lzma2') {
    return lzmaWasmDecompress(data)
  }
  throw new Error(`Unsupported compression algorithm: ${algorithm}`)
}
