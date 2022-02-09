export function b64_2ab(s: string): ArrayBuffer {
  return ua2ab(string2ua(a2b(s)))
}

function a2b(s: string): string {
  if (Buffer) {
    const buf = new Buffer(s, 'base64')
    return buf.toString('latin1')
  }
  if (typeof atob !== 'undefined') {
    return atob(s)
  }
  throw new Error('Unsupported operation a2b')
}

function string2ua(s: string): Uint8Array {
  const ua = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    ua[i] = s.charCodeAt(i) & 0xff
  }
  return ua
}

function ua2ab(ua: Uint8Array): ArrayBuffer {
  const buffer = ua.buffer
  return (buffer.byteLength > ua.byteLength ? buffer.slice(0, ua.byteLength) : buffer) as ArrayBuffer
}
