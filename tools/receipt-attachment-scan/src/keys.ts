import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { hex2ua, pkcs8ToJwk, ua2hex } from '@icure/api'

export interface LoadedPrivateKey {
  /** Path of the file the key was read from, for error reporting. */
  readonly source: string
  readonly privateJwk: JsonWebKey
  readonly publicJwk: JsonWebKey
  /** Hex encoded spki representation of the matching public key, i.e. how iCure identifies the key pair. */
  readonly publicKeySpkiHex: string
}

/** Expands the --keys arguments into the list of files to read, walking directories recursively. */
function collectKeyFiles(paths: string[]): string[] {
  const files: string[] = []
  const visit = (path: string) => {
    const stats = statSync(path)
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        if (!entry.startsWith('.')) visit(join(path, entry))
      }
    } else if (stats.isFile()) {
      files.push(path)
    }
  }
  paths.forEach(visit)
  return files
}

function isRsaJwk(value: unknown): value is JsonWebKey {
  const candidate = value as JsonWebKey | undefined
  return !!candidate && candidate.kty === 'RSA' && typeof candidate.n === 'string' && typeof candidate.d === 'string'
}

function derToJwk(der: Uint8Array, source: string): JsonWebKey {
  try {
    // Handles both PKCS#8 (the format the iCure SDK exports) and bare PKCS#1 RSAPrivateKey.
    return pkcs8ToJwk(der) as JsonWebKey
  } catch (e) {
    throw new Error(`${source}: could not parse the content as a PKCS#8 or PKCS#1 RSA private key (${(e as Error).message})`)
  }
}

function decodePem(text: string, source: string): JsonWebKey {
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(text)) {
    throw new Error(`${source}: the private key is passphrase-encrypted, decrypt it first (openssl pkcs8 -topk8 -nocrypt)`)
  }
  const match = /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END (?:RSA )?PRIVATE KEY-----/.exec(text)
  if (!match) throw new Error(`${source}: PEM file does not contain an unencrypted RSA private key block`)
  return derToJwk(new Uint8Array(Buffer.from(match[1].replace(/\s+/g, ''), 'base64')), source)
}

/** Reads one key file and returns the private keys it holds, as JWKs. There may be more than one in a json file. */
function privateJwksOfFile(path: string): JsonWebKey[] {
  const raw = readFileSync(path)
  const text = raw.toString('utf8').trim()

  if (text.includes('-----BEGIN')) return [decodePem(text, path)]

  if (text.startsWith('{') || text.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw new Error(`${path}: looks like json but could not be parsed (${(e as Error).message})`)
    }
    // A json file may hold a single jwk, a jwk set, an iCure { publicKey, privateKey } hex pair, or an array of those.
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { keys?: unknown[] }).keys)
      ? (parsed as { keys: unknown[] }).keys
      : [parsed]
    return candidates.map((candidate) => {
      if (isRsaJwk(candidate)) return candidate
      const hexPair = candidate as { privateKey?: unknown }
      if (typeof hexPair.privateKey === 'string') return derToJwk(hex2ua(hexPair.privateKey.trim()), path)
      throw new Error(`${path}: json entry is neither an RSA jwk nor an object with a hex 'privateKey' field`)
    })
  }

  const compact = text.replace(/\s+/g, '')
  if (compact.length > 0 && compact.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(compact)) {
    return [derToJwk(hex2ua(compact), path)]
  }
  if (compact.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    return [derToJwk(new Uint8Array(Buffer.from(compact, 'base64')), path)]
  }
  // Last resort: the file is a raw DER blob.
  return [derToJwk(new Uint8Array(raw), path)]
}

/**
 * Loads every private key found under the provided paths and derives the matching public key, so that each key can
 * later be attributed to the data owner that declares it. The public key is rebuilt from the private key's modulus
 * and exponent rather than trusted from the input, which also validates that the private key is well-formed.
 *
 * The spki encoding of an RSA public key does not depend on the OAEP hash, so importing with sha-1 here is enough to
 * compute the identifier; the real sha version of each pair is decided later, from the data owner that owns it.
 */
export async function loadPrivateKeys(paths: string[], crypto: Crypto): Promise<LoadedPrivateKey[]> {
  const loaded: LoadedPrivateKey[] = []
  for (const file of collectKeyFiles(paths)) {
    for (const privateJwk of privateJwksOfFile(file)) {
      const publicJwk: JsonWebKey = { kty: 'RSA', n: privateJwk.n, e: privateJwk.e }
      let publicKeySpkiHex: string
      try {
        const publicKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'RSA-OAEP', hash: 'SHA-1' }, true, ['encrypt'])
        publicKeySpkiHex = ua2hex(await crypto.subtle.exportKey('spki', publicKey))
      } catch (e) {
        throw new Error(`${file}: the RSA key could not be imported by the platform crypto (${(e as Error).message})`)
      }
      loaded.push({ source: file, privateJwk, publicJwk, publicKeySpkiHex })
    }
  }
  if (loaded.length === 0) throw new Error(`No private key found under ${paths.join(', ')}`)
  return loaded
}
