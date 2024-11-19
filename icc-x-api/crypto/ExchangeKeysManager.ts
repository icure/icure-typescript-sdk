import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { CryptoStrategies } from './CryptoStrategies'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  private cache: { [delegator: string]: { [delegate: string]: CryptoKey[] } } = {}

  get base(): BaseExchangeKeysManager {
    return this.baseExchangeKeysManager
  }

  constructor(
    private readonly keyManager: UserEncryptionKeysManager,
    private readonly baseExchangeKeysManager: BaseExchangeKeysManager,
    private readonly dataOwnerApi: IccDataOwnerXApi
  ) {}

  /**
   * Get all keys currently available for a delegator-delegate pair. At least one of the two data owners must be part of the hierarchy for the current
   * data owner.
   * @param delegatorId id of a delegator
   * @param delegateId id of a delegate
   * @throws if neither the delegator nor the delegate is part of the hierarchy of the current data owner.
   * @return all available exchange keys from the delegator-delegate pair.
   */
  async getDecryptionExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    return this.cache[delegatorId]?.[delegateId] ?? []
  }

  /**
   * Reloads all exchange keys for the cache.
   */
  async reloadCache(): Promise<void> {
    const hierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const encryptedKeysDataByHierarchyMember = Object.fromEntries(
      await Promise.all(
        hierarchy.map((doId) =>
          this.base.getAllExchangeKeysWith(doId, null).then(
            (
              res
            ): [
              string,
              {
                keysToOwner: { [p: string]: { [p: string]: { [p: string]: string } } }
                keysFromOwner: { [p: string]: { [p: string]: { [p: string]: string } } }
              }
            ] => [doId, res]
          )
        )
      )
    )
    const encryptedKeys: { [delegator: string]: { [delegate: string]: { [pubFp: string]: string }[] } } = {}
    for (const [dataOwner, info] of Object.entries(encryptedKeysDataByHierarchyMember)) {
      for (const [delegator, encryptedByDelegatorFp] of Object.entries(info.keysToOwner)) {
        if (!encryptedKeys[delegator]) {
          encryptedKeys[delegator] = {}
        }
        if (!encryptedKeys[delegator][dataOwner]) {
          encryptedKeys[delegator][dataOwner] = []
        }
        const keysForDelegatorDelegate = encryptedKeys[delegator][dataOwner]
        for (const encryptedEntries of Object.values(encryptedByDelegatorFp)) {
          keysForDelegatorDelegate.push(encryptedEntries)
        }
      }
      for (const encryptedByDelegateId of Object.values(info.keysFromOwner)) {
        for (const [delegate, encryptedEntries] of Object.entries(encryptedByDelegateId)) {
          if (!encryptedKeys[dataOwner]) {
            encryptedKeys[dataOwner] = {}
          }
          if (!encryptedKeys[dataOwner][delegate]) {
            encryptedKeys[dataOwner][delegate] = []
          }
          encryptedKeys[dataOwner][delegate].push(encryptedEntries)
        }
      }
    }
    const decryptionKeys = this.keyManager.getDecryptionKeys()
    const decrypted: { [delegator: string]: { [delegate: string]: CryptoKey[] } } = {}
    for (const [delegator, keysByDelegate] of Object.entries(encryptedKeys)) {
      const currDelegatorData: { [delegate: string]: CryptoKey[] } = {}
      for (const [delegate, keys] of Object.entries(keysByDelegate)) {
        currDelegatorData[delegate] = (await this.base.tryDecryptExchangeKeys(keys, decryptionKeys)).successfulDecryptions
      }
      decrypted[delegator] = currDelegatorData
    }
    this.cache = decrypted
  }
}
