import { CryptoStrategies } from './CryptoStrategies'
import { DataOwner } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { KeyPair } from './RSA'

/**
 * Implementation of crypto strategies which should closely resemble a basic legacy behaviour of the crypto api:
 * - Automatically creates a new key if there is no verified key available
 * - Fully trusts the public keys coming from the server for the creation of aes exchange keys to delegates
 * - Never trust the own public keys coming from the server: this way the sdk will not automatically create data for key recovery.
 */
export class LegacyCryptoStrategies implements CryptoStrategies {
  generateNewKeyForDataOwner(self: DataOwner, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean> {
    return Promise.resolve(true)
  }

  recoverAndVerifySelfHierarchyKeys(
    keysData: { dataOwner: DataOwner; unknownKeys: string[]; unavailableKeys: string[] }[],
    cryptoPrimitives: CryptoPrimitives
  ): Promise<{ [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } } }> {
    return Promise.resolve(Object.fromEntries(keysData.map(({ dataOwner }) => [dataOwner.id, { recoveredKeys: {}, keyAuthenticity: {} }])))
  }

  verifyDelegatePublicKeys(delegate: DataOwner, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }
}
