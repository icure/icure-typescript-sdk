export function ua2string(_ua: Uint8Array | ArrayBuffer): string {
  let str = ''
  const ab = new Uint8Array(_ua)
  const abLen = ab.length
  const CHUNK_SIZE = Math.pow(2, 8)
  let offset, len, subab
  for (offset = 0; offset < abLen; offset += CHUNK_SIZE) {
    len = Math.min(CHUNK_SIZE, abLen - offset)
    subab = ab.subarray(offset, offset + len)
    str += String.fromCharCode.apply(null, subab as any)
  }
  return str
}

export function string2ua(s: string): Uint8Array {
  const ua = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    ua[i] = s.charCodeAt(i) & 0xff
  }
  return ua
}

export function string2ab(s: string): ArrayBuffer {
  return ua2ab(string2ua(s))
}

export function ua2ab(ua: Uint8Array): ArrayBuffer {
  const buffer = ua.buffer
  return (buffer.byteLength > ua.byteLength ? buffer.slice(0, ua.byteLength) : buffer) as ArrayBuffer
}

export function b64_2ab(s: string): ArrayBuffer {
  return ua2ab(string2ua(a2b(s)))
}

export function b64_2ua(s: string): Uint8Array {
  return string2ua(a2b(s))
}

export function ua2b64(_ua: Uint8Array | ArrayBuffer): string {
  return b2a(ua2string(_ua))
}

export function b2a(a: string): string {
  if (typeof window !== 'undefined') {
    //Favour btoa in browser
    if (typeof btoa !== 'undefined') {
      return btoa(a)
    }
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(a, 'latin1')
      return buf.toString('base64')
    }
  } else {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(a, 'latin1')
      return buf.toString('base64')
    }
    if (typeof btoa !== 'undefined') {
      return btoa(a)
    }
  }
  throw new Error('Unsupported operation b2a')
}

export function a2b(s: string): string {
  const urlUnsafeString = s.replace(/_/g, '/').replace(/-/g, '+')
  if (typeof window !== 'undefined') {
    //Favour atob in browser
    if (typeof atob !== 'undefined') {
      return atob(urlUnsafeString)
    }
    if (typeof Buffer !== 'undefined') {
      const buf = new Buffer(urlUnsafeString, 'base64')
      return buf.toString('latin1')
    }
  } else {
    if (typeof Buffer !== 'undefined') {
      const buf = new Buffer(urlUnsafeString, 'base64')
      return buf.toString('latin1')
    }
    if (typeof atob !== 'undefined') {
      return atob(urlUnsafeString)
    }
  }
  throw new Error('Unsupported operation a2b')
}
