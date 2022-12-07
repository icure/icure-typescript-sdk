import { KeyManager } from './KeyManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { PublicKeyVerifier } from './PublicKeyVerifier'
import { loadPublicKeys } from './utils'
import { RSAUtils } from './RSA'
import { CryptoPrimitives } from './CryptoPrimitives'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  private readonly keyManager: KeyManager
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly publicKeyVerifier: PublicKeyVerifier
  private readonly primitives: CryptoPrimitives
  /*
   * Exchange keys cache where the current user is the delegator. There should be only few keys where the delegator is the current user, and they
   * should never change without an action from the delegator (unless he does this action from another device), so it should be safe to store them
   * in an unlimited cache and without expiration.
   */
  private delegatorExchangeKeys: Map<string, Promise<{ key: CryptoKey; isVerified: boolean }[]>> = new Map()
  /*
   * Exchange keys cache where the current user is the delegate and not the delegator. There may be many keys where the current user is the delegate,
   * and they may change over time without any action from the current data owner, since the delegator is someone else. For this reason the cache must
   * be limited in size and it should not use data that is too old, as it may be outdated.
   */
  private delegatedExchangeKeysCache: LruTemporisedAsyncCache<string, CryptoKey[]>

  constructor(
    delegatedKeysCacheSize: number,
    delegatedKeysCacheLifetimeMs: number,
    publicKeyVerifier: PublicKeyVerifier,
    primitives: CryptoPrimitives,
    keyManager: KeyManager,
    baseExchangeKeysManager: BaseExchangeKeysManager,
    dataOwnerApi: IccDataOwnerXApi
  ) {
    this.primitives = primitives
    this.publicKeyVerifier = publicKeyVerifier
    this.keyManager = keyManager
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
    this.delegatedExchangeKeysCache = new LruTemporisedAsyncCache(delegatedKeysCacheSize, delegatedKeysCacheLifetimeMs)
  }

  /**
   * Get exchange keys from the current data owner to the provided delegate which are safe for encryption according to the locally verified keys.
   * If currently there is no exchange key towards the provided delegate which is safe for encryption a new one will be automatically created.
   * @param delegateId a delegate
   * @return an object with the following fields:
   *  - keys: all available exchange keys which are safe for encryption.
   *  - updatedDelegator (optional): if a new key creation job was started when the function was invoked the updated delegator, else undefined.
   */
  async getOrCreateEncryptionExchangeKeysTo(delegateId: string): Promise<{ updatedDelegator?: DataOwnerWithType; keys: CryptoKey[] }> {
    const currentKeys = await this.getSelfExchangeKeysTo(delegateId)
    const verifiedKeys = currentKeys.filter((x) => x.isVerified)
    if (verifiedKeys.length > 0) {
      return { keys: verifiedKeys.map((x) => x.key) }
    } else {
      const keyCreationJob = this.forceCreateVerifiedExchangeKeyTo(delegateId)
      this.delegatorExchangeKeys.set(
        delegateId,
        keyCreationJob.then(({ key: newKey }) => [...currentKeys, { key: newKey, isVerified: true }])
      )
      return await keyCreationJob.then(({ key: newKey, updatedDelegator }) => ({ keys: [newKey], updatedDelegator }))
      /*NOTE:
       * in case of two concurrent calls to `getOrCreateEncryptionExchangeKeysTo` only one of the calls will receive the updated delegator. This could
       * be a problem if one of the callers would want to update the delegator for other reasons as well, as the request would result in a database
       * conflict. This situation however should be very rare and will be fully resolved in the near future when delegations will be moved out of the
       * data owner objects and into a specific database.
       */
    }
  }

  /**
   * Get all keys currently available for a delegator-delegate pair. At least one of the two data owners must be part of the hierarchy for the current
   * data owner.
   * @param delegatorId id of a delegator
   * @param delegateId id of a delegate
   * @throws if neither the delegator nor the delegate is part of the hierarchy of the current data owner.
   * @return all available exchange keys from the delegator-delegate pair.
   */
  async getExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    if (delegatorId === (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      const keysWithVerification = await this.getSelfExchangeKeysTo(delegateId)
      return keysWithVerification.map((x) => x.key)
    } else {
      const key = `${delegatorId}->${delegateId}`
      const hierarchyIds = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      if (!hierarchyIds.some((x) => x === delegateId || x === delegatorId)) {
        throw `Trying to retrieve exchange key ${key} but current data owner hierarchy is ${hierarchyIds}`
      }
      return await this.delegatedExchangeKeysCache.get(key, () => this.forceGetExchangeKeysFor(delegatorId, delegateId))
    }
  }

  private async forceGetExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    const encKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(delegatorId, delegateId)
    return (await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encKeys, this.keyManager.getDecryptionKeys())).successfulDecryptions
  }

  private async getSelfExchangeKeysTo(delegateId: string): Promise<{ key: CryptoKey; isVerified: boolean }[]> {
    const job = this.delegatorExchangeKeys.get(delegateId)
    if (job) {
      return job
    } else {
      const newJob = this.forceGetSelfExchangeKeysTo(delegateId)
      this.delegatorExchangeKeys.set(delegateId, newJob)
      return newJob
    }
  }

  private async forceGetSelfExchangeKeysTo(delegateId: string): Promise<{ key: CryptoKey; isVerified: boolean }[]> {
    // Retrieve then try to decrypt with own and parent key pairs
    const encKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    const { successfulDecryptions } = await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encKeys, this.keyManager.getDecryptionKeys())
    return successfulDecryptions.map((x) => ({ key: x, isVerified: true })) // TODO currently there is no verification
  }

  private async forceCreateVerifiedExchangeKeyTo(delegateId: string): Promise<{ updatedDelegator: DataOwnerWithType; key: CryptoKey }> {
    const [mainKey, ...otherSelfKeys] = this.keyManager.getSelfVerifiedKeys()
    let otherPublicKeys = Object.fromEntries(otherSelfKeys.map((x) => [x.fingerprint, x.pair.publicKey]))
    if (delegateId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      const delegate = await this.dataOwnerApi.getDataOwner(delegateId)
      const delegatePublicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(delegate))
      const verifiedDelegatePublicKeys = await this.publicKeyVerifier.verifyDelegatePublicKeys(delegate, delegatePublicKeys)
      if (!verifiedDelegatePublicKeys) throw `No verified public keys for delegate ${delegateId}: impossible to create new exchange key.`
      otherPublicKeys = {
        ...otherPublicKeys,
        ...(await loadPublicKeys(this.primitives.RSA, verifiedDelegatePublicKeys)),
      }
    }
    return await this.baseExchangeKeysManager.createOrUpdateEncryptedExchangeKeyFor(
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      delegateId,
      mainKey.pair,
      otherPublicKeys
    )
  }
}
