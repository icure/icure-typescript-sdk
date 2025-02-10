import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { CryptoPrimitives } from './CryptoPrimitives'
import { CryptoStrategies } from './CryptoStrategies'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'

type CacheValue =
  | {
      encrypted: { [fp: string]: string }[]
    }
  | {
      decrypted: Promise<CryptoKey[]>
    }

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  private cache: Promise<{ [delegator: string]: { [delegate: string]: CacheValue } }> = Promise.reject(new Error('Cache not initialized'))

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
    const cache = await this.cache
    const entry = cache[delegatorId]?.[delegateId]
    if (entry != undefined) {
      if ('decrypted' in entry) {
        return await entry.decrypted
      } else {
        const decryptedPromise = this.decryptChunk(entry.encrypted)
        cache[delegatorId][delegateId] = { decrypted: decryptedPromise }
        return await decryptedPromise
      }
    } else {
      return []
    }
  }

  private async decryptChunk(encryptedKeys: { [fp: string]: string }[]): Promise<CryptoKey[]> {
    const decryptionKeys = this.keyManager.getDecryptionKeys()
    return (await this.base.tryDecryptExchangeKeys(encryptedKeys, decryptionKeys)).successfulDecryptions
  }

  /**
   * Reloads all exchange keys for the cache.
   */
  async reloadCache(): Promise<void> {
    this.cache = this.doGetCache()
  }

  private async doGetCache() {
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
    const encryptedKeys: { [delegator: string]: { [delegate: string]: { encrypted: { [pubFp: string]: string }[] } } } = {}
    for (const [dataOwner, info] of Object.entries(encryptedKeysDataByHierarchyMember)) {
      for (const [delegator, encryptedByDelegatorFp] of Object.entries(info.keysToOwner)) {
        if (!encryptedKeys[delegator]) {
          encryptedKeys[delegator] = {}
        }
        if (!encryptedKeys[delegator][dataOwner]) {
          encryptedKeys[delegator][dataOwner] = { encrypted: [] }
        }
        const keysForDelegatorDelegate = encryptedKeys[delegator][dataOwner]
        for (const encryptedEntries of Object.values(encryptedByDelegatorFp)) {
          keysForDelegatorDelegate.encrypted.push(encryptedEntries)
        }
      }
      for (const encryptedByDelegateId of Object.values(info.keysFromOwner)) {
        for (const [delegate, encryptedEntries] of Object.entries(encryptedByDelegateId)) {
          if (!encryptedKeys[dataOwner]) {
            encryptedKeys[dataOwner] = {}
          }
          if (!encryptedKeys[dataOwner][delegate]) {
            encryptedKeys[dataOwner][delegate] = { encrypted: [] }
          }
          encryptedKeys[dataOwner][delegate].encrypted.push(encryptedEntries)
        }
      }
    }
    return encryptedKeys
  }
}
