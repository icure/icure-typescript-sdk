import { CryptoStrategies } from '../../icc-x-api/crypto/CryptoStrategies'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { DataOwner } from '../../icc-x-api/icc-data-owner-x-api'

export class TestCryptoStrategies implements CryptoStrategies {
  private readonly keyPair: KeyPair<CryptoKey> | undefined
  private readonly verifiedSelfKeys: { [p: string]: boolean }

  constructor(keyPair?: KeyPair<CryptoKey>, verifiedSelfKeys: { [p: string]: boolean } = {}) {
    this.keyPair = keyPair
    this.verifiedSelfKeys = verifiedSelfKeys
  }

  createNewKeyPairIfNoVerifiedKeysFound(): Promise<boolean | KeyPair<CryptoKey>> {
    return Promise.resolve(this.keyPair ? this.keyPair : false)
  }

  verifyDelegatePublicKeys(delegate: DataOwner, publicKeys: string[]): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }

  verifyOwnPublicKeys(self: DataOwner, publicKeys: string[]): Promise<{ [p: string]: boolean }> {
    return Promise.resolve({ ...this.verifiedSelfKeys })
  }
}
