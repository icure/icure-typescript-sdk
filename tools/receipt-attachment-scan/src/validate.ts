import { XMLValidator } from 'fast-xml-parser'

export type PayloadFormat = 'xml' | 'json' | 'unrecognised'

export interface PayloadVerdict {
  format: PayloadFormat
  /** Why the payload was rejected, or what it turned out to be. */
  detail: string
  /** Best guess of what the bytes actually are, when they are neither xml nor json. */
  sniffed?: string
  /** First bytes of the payload, hex and printable-ascii, to help identify a corrupted payload. */
  preview?: string
}

/** Magic numbers worth naming in a report: seeing 'gzip' or 'xz' here points straight at a compression bug. */
const MAGIC: { name: string; bytes: number[] }[] = [
  { name: 'gzip', bytes: [0x1f, 0x8b] },
  { name: 'xz', bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { name: 'lzma (alone)', bytes: [0x5d, 0x00, 0x00] },
  { name: 'zlib/deflate', bytes: [0x78, 0x9c] },
  { name: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'bzip2', bytes: [0x42, 0x5a, 0x68] },
  { name: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { name: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { name: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
]

function sniff(bytes: Uint8Array): string | undefined {
  const hit = MAGIC.find(({ bytes: magic }) => magic.every((b, i) => bytes[i] === b))
  return hit?.name
}

export function preview(bytes: Uint8Array, length = 32): string {
  const head = bytes.subarray(0, length)
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join(' ')
  const ascii = Array.from(head, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
  return `${hex}  |${ascii}|`
}

/** Strips a UTF-8/UTF-16 BOM and leading whitespace, which are legal in front of both xml and json. */
function withoutLeadingNoise(bytes: Uint8Array): Uint8Array {
  let start = 0
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3
  else if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) start = 2
  while (start < bytes.length && (bytes[start] === 0x20 || bytes[start] === 0x09 || bytes[start] === 0x0a || bytes[start] === 0x0d)) start++
  return bytes.subarray(start)
}

/**
 * Decides whether a decrypted attachment is a valid XML document or a valid JSON document.
 *
 * A json scalar (`42`, `"text"`, `null`) is not treated as a document: a receipt payload is always an object or an
 * array, and accepting scalars would silently pass truncated or garbage payloads.
 */
export function classifyPayload(data: ArrayBuffer): PayloadVerdict {
  const bytes = new Uint8Array(data)
  if (bytes.byteLength === 0) return { format: 'unrecognised', detail: 'the attachment is empty' }

  const trimmed = withoutLeadingNoise(bytes)
  const firstByte = trimmed[0]

  // Only decode what we need to: an utf-16 or binary payload would produce a useless multi-megabyte string.
  const looksLikeXml = firstByte === 0x3c /* '<' */
  const looksLikeJson = firstByte === 0x7b /* '{' */ || firstByte === 0x5b /* '[' */

  if (looksLikeXml) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(trimmed)
    const validation = XMLValidator.validate(text, { allowBooleanAttributes: true })
    if (validation === true) return { format: 'xml', detail: `valid xml, ${bytes.byteLength} bytes` }
    return {
      format: 'unrecognised',
      detail: `starts like xml but is invalid: ${validation.err.msg} (line ${validation.err.line}, col ${validation.err.col})`,
      preview: preview(bytes),
    }
  }

  if (looksLikeJson) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(trimmed)
    try {
      const parsed = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object') return { format: 'json', detail: `valid json, ${bytes.byteLength} bytes` }
      return { format: 'unrecognised', detail: 'parses as json but is a scalar, not a document', preview: preview(bytes) }
    } catch (e) {
      return { format: 'unrecognised', detail: `starts like json but is invalid: ${(e as Error).message}`, preview: preview(bytes) }
    }
  }

  return {
    format: 'unrecognised',
    detail: 'neither xml nor json: the payload does not start with <, { or [',
    sniffed: sniff(trimmed),
    preview: preview(bytes),
  }
}
