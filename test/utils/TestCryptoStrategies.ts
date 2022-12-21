import { CryptoStrategies } from '../../icc-x-api/crypto/CryptoStrategies'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { DataOwner } from '../../icc-x-api/icc-data-owner-x-api'

export class TestCryptoStrategies implements CryptoStrategies {
  private readonly keyPair: KeyPair<CryptoKey>

  constructor(keyPair: KeyPair<CryptoKey>) {
    this.keyPair = keyPair
  }

  createNewKeyPairIfNoVerifiedKeysFound(): Promise<boolean | KeyPair<CryptoKey>> {
    return Promise.resolve(this.keyPair)
  }

  verifyDelegatePublicKeys(delegate: DataOwner, publicKeys: string[]): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }

  verifyOwnPublicKeys(self: DataOwner, publicKeys: string[]): Promise<{ [p: string]: boolean }> {
    return Promise.resolve({})
  }
}
