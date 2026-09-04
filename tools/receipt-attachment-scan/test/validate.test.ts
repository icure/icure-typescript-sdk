import { describe, expect, it } from 'bun:test'
import { classifyPayload } from '../src/validate'

const bytes = (input: string | number[]): ArrayBuffer =>
  typeof input === 'string' ? (new TextEncoder().encode(input).buffer as ArrayBuffer) : (new Uint8Array(input).buffer as ArrayBuffer)

describe('classifyPayload', () => {
  it('accepts a well formed xml document', () => {
    const verdict = classifyPayload(bytes('<?xml version="1.0"?><root><a x="1">text</a></root>'))
    expect(verdict.format).toBe('xml')
  })

  it('accepts xml behind a utf-8 bom and leading whitespace', () => {
    const verdict = classifyPayload(bytes([0xef, 0xbb, 0xbf, 0x0a, 0x20, ...new TextEncoder().encode('<a/>')]))
    expect(verdict.format).toBe('xml')
  })

  it('rejects truncated xml and says where it broke', () => {
    const verdict = classifyPayload(bytes('<root><a>text</a>'))
    expect(verdict.format).toBe('unrecognised')
    expect(verdict.detail).toMatch(/starts like xml but is invalid/)
  })

  it('accepts a json object and a json array', () => {
    expect(classifyPayload(bytes('{"a":1}')).format).toBe('json')
    expect(classifyPayload(bytes('[1,2,3]')).format).toBe('json')
  })

  it('rejects truncated json', () => {
    const verdict = classifyPayload(bytes('{"a":1'))
    expect(verdict.format).toBe('unrecognised')
    expect(verdict.detail).toMatch(/starts like json but is invalid/)
  })

  it('rejects an empty attachment', () => {
    expect(classifyPayload(new ArrayBuffer(0))).toEqual({ format: 'unrecognised', detail: 'the attachment is empty' })
  })

  it('names the format of a payload that is neither xml nor json', () => {
    const verdict = classifyPayload(bytes([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02]))
    expect(verdict.format).toBe('unrecognised')
    expect(verdict.sniffed).toBe('gzip')
    expect(verdict.preview).toMatch(/^1f 8b 08 00/)
  })

  it('does not accept a bare json scalar as a document', () => {
    // '42' does not start with { or [, so it lands in the generic branch rather than being called valid json.
    expect(classifyPayload(bytes('42')).format).toBe('unrecognised')
  })
})
