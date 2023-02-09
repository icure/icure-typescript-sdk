import { CryptoStrategies } from './CryptoStrategies'
import { DataOwner, DataOwnerTypeEnum, DataOwnerWithType } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { KeyPair } from './RSA'

/**
 * Implementation of crypto strategies which should closely resemble a basic legacy behaviour of the crypto api in regard to user keys management
 * and server trust:
 * - Automatically creates a new key if there is no verified key available
 * - Fully trusts the public keys coming from the server for the creation of aes exchange keys to delegates
 * - Never trust the own public keys coming from the server: this way the sdk will not automatically create data for key recovery.
 *
 * Data owner delegation anonymity requirements instead are changed to require anonymous delegations for all data owners which are not hcps (instead
 * of never requiring anonymous delegations).
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

  dataOwnerRequiresAnonymousDelegation(dataOwner: DataOwnerWithType): boolean {
    return dataOwner.type !== DataOwnerTypeEnum.Hcp
  }
}
