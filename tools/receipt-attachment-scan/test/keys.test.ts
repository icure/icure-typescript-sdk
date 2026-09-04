import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ua2hex } from '@icure/api'
import { loadPrivateKeys } from '../src/keys'

/** Wraps a DER blob in a PEM armour, 64 characters per line as openssl does. */
function toPem(der: ArrayBuffer, label: string): string {
  const b64 = Buffer.from(der)
    .toString('base64')
    .replace(/(.{64})/g, '$1\n')
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`
}

describe('loadPrivateKeys', () => {
  let dir: string
  let expectedPublicKeyHex: string

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'receipt-scan-keys-'))
    const pair = (await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' },
      true,
      ['encrypt', 'decrypt']
    )) as CryptoKeyPair
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
    expectedPublicKeyHex = ua2hex(await crypto.subtle.exportKey('spki', pair.publicKey))

    writeFileSync(join(dir, 'a-hex.key'), ua2hex(pkcs8))
    writeFileSync(join(dir, 'b-pem.pem'), toPem(pkcs8, 'PRIVATE KEY'))
    writeFileSync(join(dir, 'c-der.der'), Buffer.from(pkcs8))
    writeFileSync(join(dir, 'd-base64.txt'), Buffer.from(pkcs8).toString('base64'))
    writeFileSync(join(dir, 'e-jwk.json'), JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)))
    writeFileSync(join(dir, 'f-icure.json'), JSON.stringify({ publicKey: expectedPublicKeyHex, privateKey: ua2hex(pkcs8) }))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('reads every supported key format and derives the same public key from each', async () => {
    const loaded = await loadPrivateKeys([dir], crypto)
    expect(loaded).toHaveLength(6)
    expect(new Set(loaded.map((it) => it.publicKeySpkiHex))).toEqual(new Set([expectedPublicKeyHex]))
  })

  it('accepts a single file as well as a directory', async () => {
    const loaded = await loadPrivateKeys([join(dir, 'b-pem.pem')], crypto)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].publicKeySpkiHex).toBe(expectedPublicKeyHex)
  })

  it('rejects a passphrase protected key with an actionable message', async () => {
    const encrypted = join(dir, 'encrypted.pem')
    writeFileSync(encrypted, '-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----\n')
    await expect(loadPrivateKeys([encrypted], crypto)).rejects.toThrow(/passphrase-encrypted/)
  })

  it('fails when no key can be found', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'receipt-scan-empty-'))
    await expect(loadPrivateKeys([empty], crypto)).rejects.toThrow(/No private key found/)
    rmSync(empty, { recursive: true, force: true })
  })
})
