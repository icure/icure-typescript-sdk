import {
  type CryptoActorStubWithType,
  type CryptoPrimitives,
  type CryptoStrategies,
  type DataOwnerWithType,
  getShaVersionForKey,
  type KeyPair,
} from '@icure/api'
import type { LoadedPrivateKey } from './keys'

/**
 * Crypto strategies for a read-only scan.
 *
 * The keys given on the command line are handed to the SDK for whichever data owner of the hierarchy declares the
 * matching public key. Nothing else is allowed to happen: no key is generated, and no delegate public key is ever
 * accepted, so the scan can never create a new exchange key or share anything.
 */
export class ScannerCryptoStrategies implements CryptoStrategies {
  /** Public keys (spki hex) that were attributed to a data owner, i.e. the keys that turned out to be useful. */
  readonly attributedKeys = new Map<string, { dataOwnerId: string; shaVersion: string; source: string }>()

  constructor(private readonly keys: LoadedPrivateKey[]) {}

  async recoverAndVerifySelfHierarchyKeys(
    keysData: { dataOwner: DataOwnerWithType; unknownKeys: string[]; unavailableKeys: string[] }[],
    cryptoPrimitives: CryptoPrimitives
  ): Promise<{
    [dataOwnerId: string]: { recoveredKeys: { [keyPairFingerprint: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [k: string]: boolean } }
  }> {
    const result: { [dataOwnerId: string]: { recoveredKeys: { [fp: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [fp: string]: boolean } } } = {}
    for (const { dataOwner } of keysData) {
      const recoveredKeys: { [fp: string]: KeyPair<CryptoKey> } = {}
      const keyAuthenticity: { [fp: string]: boolean } = {}
      for (const key of this.keys) {
        // The data owner tells us whether the pair was generated for RSA-OAEP with sha-1 or with sha-256; a key the
        // data owner does not declare simply belongs to somebody else in the hierarchy (or to nobody).
        const shaVersion = getShaVersionForKey(dataOwner.dataOwner, key.publicKeySpkiHex)
        if (!shaVersion) continue
        const fingerprint = key.publicKeySpkiHex.slice(-32)
        recoveredKeys[fingerprint] = await cryptoPrimitives.RSA.importKeyPair('jwk', key.privateJwk, 'jwk', key.publicJwk, shaVersion)
        keyAuthenticity[fingerprint] = true
        this.attributedKeys.set(key.publicKeySpkiHex, { dataOwnerId: dataOwner.dataOwner.id!, shaVersion, source: key.source })
      }
      result[dataOwner.dataOwner.id!] = { recoveredKeys, keyAuthenticity }
    }
    return result
  }

  /** Never generate a key: a missing key must fail the scan loudly rather than silently produce a useless report. */
  async generateNewKeyForDataOwner(): Promise<false> {
    return false
  }

  /**
   * Trust no external delegate key. The SDK only consults this when creating exchange data towards a data owner that
   * is neither the current one nor one of its parents, which is a write path the scan never takes, so returning
   * nothing here cannot block initialisation.
   */
  async verifyDelegatePublicKeys(_delegate: CryptoActorStubWithType, _publicKeys: string[]): Promise<string[]> {
    return []
  }

  dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
    return dataOwner.type !== 'hcp'
  }

  /** Keys that were read from disk but that no data owner of the hierarchy claims. */
  unusedKeys(): LoadedPrivateKey[] {
    return this.keys.filter((key) => !this.attributedKeys.has(key.publicKeySpkiHex))
  }
}
