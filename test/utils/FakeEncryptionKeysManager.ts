import { UserEncryptionKeysManager } from '../../icc-x-api/crypto/UserEncryptionKeysManager'
import { DataOwner } from '../../icc-x-api/icc-data-owner-x-api'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { ua2hex } from '../../icc-x-api'
import * as _ from 'lodash'
import { fingerprintV1 } from '../../icc-x-api/crypto/utils'

export class FakeEncryptionKeysManager extends UserEncryptionKeysManager {
  constructor(private readonly keys: { [fingerprint: string]: { pair: KeyPair<CryptoKey>; verified: boolean } }) {
    super(null as any, null as any, null as any, null as any, null as any, null as any, null as any)
  }

  static async create(
    primitives: CryptoPrimitives,
    verifiedKeys: KeyPair<CryptoKey>[],
    unverifiedKeys: KeyPair<CryptoKey>[] = []
  ): Promise<FakeEncryptionKeysManager> {
    const keysByFingerprint = {} as { [fingerprint: string]: { pair: KeyPair<CryptoKey>; verified: boolean } }
    for (const key of verifiedKeys) {
      const fingerprint = fingerprintV1(ua2hex(await primitives.RSA.exportKey(key.publicKey, 'spki')))
      keysByFingerprint[fingerprint] = { pair: key, verified: true }
    }
    for (const key of unverifiedKeys) {
      const fingerprint = fingerprintV1(ua2hex(await primitives.RSA.exportKey(key.publicKey, 'spki')))
      keysByFingerprint[fingerprint] = { pair: key, verified: false }
    }
    return new FakeEncryptionKeysManager(keysByFingerprint)
  }

  async getCurrentUserAvailablePublicKeysHex(verifiedOnly: boolean): Promise<string[]> {
    throw new Error('Not implemented')
  }

  async getCurrentUserHierarchyAvailablePublicKeysHex(): Promise<string[]> {
    throw new Error('Not implemented')
  }

  getKeyPairForFingerprint(fingerprint: string): { pair: KeyPair<CryptoKey>; verified: boolean } | undefined {
    const key = this.keys[fingerprint]
    if (key) return _.cloneDeep(key)
    return undefined
  }

  async initialiseKeys(): Promise<{ newKeyPair: KeyPair<CryptoKey>; newKeyFingerprint: string } | undefined> {
    return Promise.resolve(undefined)
  }

  async reloadKeys(): Promise<void> {}

  getSelfVerifiedKeys(): { fingerprint: string; pair: KeyPair<CryptoKey> }[] {
    const res = []
    for (const [fingerprint, { pair, verified }] of Object.entries(this.keys)) {
      if (verified) res.push({ fingerprint, pair })
    }
    return res
  }

  async getVerifiedPublicKeysFor(dataOwner: DataOwner): Promise<string[]> {
    throw new Error('Not implemented')
  }

  getDecryptionKeys(): { [p: string]: KeyPair<CryptoKey> } {
    return Object.fromEntries(Object.entries(this.keys).map(([fp, { pair }]) => [fp, pair]))
  }

  deleteKey(fp: string) {
    delete this.keys[fp]
  }

  async addOrUpdateKey(primitives: CryptoPrimitives, pair: KeyPair<CryptoKey>, verified: boolean) {
    const fp = fingerprintV1(ua2hex(await primitives.RSA.exportKey(pair.publicKey, 'spki')))
    this.keys[fp] = { pair, verified }
  }
}
