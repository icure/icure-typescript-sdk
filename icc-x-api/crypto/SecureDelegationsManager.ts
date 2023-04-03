import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { CryptoStrategies } from './CryptoStrategies'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { hexPublicKeysOf } from './utils'
import { ExchangeDataManager } from './ExchangeDataManager'
import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { SecureDelegationsEncryption } from './SecureDelegationsEncryption'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua } from '../utils'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { EntityShareOrMetadataUpdateRequest } from '../../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { EntitySharedMetadataUpdateRequest } from '../../icc-api/model/requests/EntitySharedMetadataUpdateRequest'
import EntryUpdateTypeEnum = EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum

export class SecureDelegationsManager {
  constructor(
    private readonly exchangeDataManager: ExchangeDataManager,
    private readonly secureDelegationsEncryption: SecureDelegationsEncryption,
    private readonly accessControlSecretUtils: AccessControlSecretUtils,
    private readonly userKeys: UserEncryptionKeysManager,
    private readonly primitives: CryptoPrimitives,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly cryptoStrategies: CryptoStrategies,
    private readonly selfNeedsAnonymousDelegations: boolean
  ) {}

  private readonly dataOwnerInfoCache: LruTemporisedAsyncCache<
    string,
    {
      requiresAnonymousDelegations: boolean
      availablePublicKeysHex: string[]
    }
  > = new LruTemporisedAsyncCache(100, () => 30 * 60 * 1000)

  /**
   * Make a request for sharing an entity with a delegate or to update existing shared metadata by adding additional secretIds, encryptionKeys or
   * owningEntityIds if there is already some metadata shared between the current data owner and the delegate. In case there is already a delegation
   * for the delegate, and it already contains all the provided metadata, this method returns undefined, since there is no need to make any request to
   * share the provided data.
   * @param entityWithType an entity with type
   * @param delegateId the id of the delegate
   * @param shareSecretIds the secret ids to share
   * @param shareEncryptionKeys the encryption keys to share
   * @param shareOwningEntityIds the owning entity ids to share
   * @param newDelegationPermissions the permissions to grant to the delegate in case a new delegation needs to be created. If this method creates an
   * update request instead of a share request, this parameter is ignored.
   * @return the request to share the entity, or the request to update the shared metadata for the entity, or undefined if there is no need to update
   * the entity to allow the delegate to access the provided data.
   */
  async makeShareOrUpdateRequestParams(
    entityWithType: EncryptedEntityWithType,
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[],
    newDelegationPermissions: EntityShareRequest.RequestedPermissionEnum
  ): Promise<EntityShareOrMetadataUpdateRequest | undefined> {
    const exchangeDataInfo = await this.exchangeDataManager.getOrCreateEncryptionDataTo(
      delegateId,
      entityWithType.type,
      entityWithType.entity.secretForeignKeys ?? []
    )
    const accessControlHashes = await this.accessControlSecretUtils.secureDelegationKeysFor(
      exchangeDataInfo.accessControlSecret,
      entityWithType.type,
      entityWithType.entity.secretForeignKeys ?? []
    )
    const existingSecureDelegation = this.getExistingCanonicalKeyAndSecureDelegation(entityWithType.entity, accessControlHashes)
    if (existingSecureDelegation) {
      const updateParams = await this.makeUpdateRequestParams(
        existingSecureDelegation.canonicalKey,
        existingSecureDelegation.secureDelegation,
        exchangeDataInfo,
        shareSecretIds,
        shareEncryptionKeys,
        shareOwningEntityIds
      )
      return updateParams ? { update: updateParams } : undefined
    } else {
      return {
        share: await this.makeShareRequestParams(
          exchangeDataInfo,
          accessControlHashes,
          delegateId,
          shareSecretIds,
          shareEncryptionKeys,
          shareOwningEntityIds,
          newDelegationPermissions
        ),
      }
    }
  }

  private async makeUpdateRequestParams(
    canonicalKey: string,
    existingDelegation: SecureDelegation,
    exchangeDataInfo: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey },
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[]
  ): Promise<EntitySharedMetadataUpdateRequest | undefined> {
    const existingSecretIds = new Set(await this.secureDelegationsEncryption.decryptSecretIds(existingDelegation, exchangeDataInfo.exchangeKey))
    const existingEncryptionKeys = new Set(
      await this.secureDelegationsEncryption.decryptEncryptionKeys(existingDelegation, exchangeDataInfo.exchangeKey)
    )
    const existingOwningEntityIds = new Set(
      await this.secureDelegationsEncryption.decryptOwningEntityIds(existingDelegation, exchangeDataInfo.exchangeKey)
    )
    const newSecretIds = shareSecretIds.filter((id) => !existingSecretIds.has(id))
    const newEncryptionKeys = shareEncryptionKeys.filter((key) => !existingEncryptionKeys.has(key))
    const newOwningEntityIds = shareOwningEntityIds.filter((id) => !existingOwningEntityIds.has(id))
    if (newSecretIds.length || newEncryptionKeys.length || newOwningEntityIds.length) {
      const encryptedNewSecretIds = await this.secureDelegationsEncryption.encryptSecretIds(newSecretIds, exchangeDataInfo.exchangeKey)
      const encryptedNewEncryptionKeys = await this.secureDelegationsEncryption.encryptEncryptionKeys(newEncryptionKeys, exchangeDataInfo.exchangeKey)
      const encryptedNewOwningEntityIds = await this.secureDelegationsEncryption.encryptOwningEntityIds(
        newOwningEntityIds,
        exchangeDataInfo.exchangeKey
      )
      return new EntitySharedMetadataUpdateRequest({
        metadataAccessControlHash: canonicalKey,
        secretIds: Object.fromEntries(encryptedNewSecretIds.map((id) => [id, EntryUpdateTypeEnum.CREATE])),
        encryptionKeys: Object.fromEntries(encryptedNewEncryptionKeys.map((key) => [key, EntryUpdateTypeEnum.CREATE])),
        owningEntityIds: Object.fromEntries(encryptedNewOwningEntityIds.map((id) => [id, EntryUpdateTypeEnum.CREATE])),
      })
    } else return undefined
  }

  private async makeShareRequestParams(
    exchangeDataInfo: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey },
    accessControlHashes: string[],
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[],
    newDelegationPermissions: EntityShareRequest.RequestedPermissionEnum
  ): Promise<EntityShareRequest> {
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const exchangeDataIdInfo =
      delegateId === selfId
        ? this.makeExchangeDataIdInfoForSelf(selfId, exchangeDataInfo.exchangeData)
        : await this.makeExchangeDataIdInfoForDelegate(selfId, delegateId, exchangeDataInfo.exchangeData)
    const encryptedSecretIds = await this.secureDelegationsEncryption.encryptSecretIds(shareSecretIds, exchangeDataInfo.exchangeKey)
    const encryptedEncryptionKeys = await this.secureDelegationsEncryption.encryptEncryptionKeys(shareEncryptionKeys, exchangeDataInfo.exchangeKey)
    const encryptedOwningEntityIds = await this.secureDelegationsEncryption.encryptOwningEntityIds(shareOwningEntityIds, exchangeDataInfo.exchangeKey)
    return new EntityShareRequest({
      ...exchangeDataIdInfo,
      secretIds: encryptedSecretIds,
      encryptionKeys: encryptedEncryptionKeys,
      owningEntityIds: encryptedOwningEntityIds,
      requestedPermissions: newDelegationPermissions,
      accessControlHashes,
    })
  }

  private async makeExchangeDataIdInfoForDelegate(
    selfId: string,
    delegateId: string,
    exchangeData: ExchangeData
  ): Promise<{
    exchangeDataId?: string
    encryptedExchangeDataId?: { [fp: string]: string }
    explicitDelegator?: string
    explicitDelegate?: string
  }> {
    const delegateInfo = await this.getDataOwnerInfo(delegateId)
    if (!delegateInfo.requiresAnonymousDelegations && !this.selfNeedsAnonymousDelegations) {
      return {
        explicitDelegator: selfId,
        explicitDelegate: delegateId,
        exchangeDataId: exchangeData.id,
      }
    } else if (delegateInfo.requiresAnonymousDelegations && !this.selfNeedsAnonymousDelegations) {
      return {
        explicitDelegator: selfId,
        encryptedExchangeDataId: await this.secureDelegationsEncryption.encryptExchangeDataId(
          exchangeData.id!,
          Object.fromEntries(this.userKeys.getSelfVerifiedKeys().map((keyInfo) => [keyInfo.fingerprint, keyInfo.pair.publicKey]))
        ),
      }
    } else if (!delegateInfo.requiresAnonymousDelegations && this.selfNeedsAnonymousDelegations) {
      const fingerprintsOfVerifiedExchangeData = new Set(Object.keys(exchangeData.exchangeKey))
      const delegateVerifiedKeys: { [fp: string]: CryptoKey } = {}
      for (const keyHex of delegateInfo.availablePublicKeysHex) {
        const currFp = keyHex.slice(-32)
        if (fingerprintsOfVerifiedExchangeData.has(currFp)) {
          delegateVerifiedKeys[currFp] = await this.primitives.RSA.importKey('spki', hex2ua(keyHex), ['encrypt'])
        }
      }
      if (!Object.keys(delegateVerifiedKeys).length)
        throw new Error('Illegal state: could not find any verified key for delegate in verified exchange data.')
      return {
        explicitDelegate: delegateId,
        encryptedExchangeDataId: await this.secureDelegationsEncryption.encryptExchangeDataId(exchangeData.id!, delegateVerifiedKeys),
      }
    } else return {}
  }

  private makeExchangeDataIdInfoForSelf(
    selfId: string,
    exchangeData: ExchangeData
  ): {
    exchangeDataId?: string
    encryptedExchangeDataId?: { [fp: string]: string }
    explicitDelegator?: string
    explicitDelegate?: string
  } {
    if (this.selfNeedsAnonymousDelegations) {
      return {}
    } else {
      return {
        exchangeDataId: exchangeData.id,
        explicitDelegator: selfId,
        explicitDelegate: selfId,
      }
    }
  }

  private async getDataOwnerInfo(dataOwnerId: string) {
    return this.dataOwnerInfoCache.get(dataOwnerId, async () => {
      const dataOwnerWithType = await this.dataOwnerApi.getDataOwner(dataOwnerId)
      return {
        item: {
          requiresAnonymousDelegations: this.cryptoStrategies.dataOwnerRequiresAnonymousDelegation(dataOwnerWithType),
          availablePublicKeysHex: Array.from(hexPublicKeysOf(dataOwnerWithType.dataOwner)),
        },
      }
    })
  }

  private getExistingCanonicalKeyAndSecureDelegation(
    entity: EncryptedEntityStub | EncryptedEntity,
    hashes: string[]
  ): { canonicalKey: string; secureDelegation: SecureDelegation } | undefined {
    const securityMetadata = entity.securityMetadata ?? {}
    const canonicalByEquivalences = Array.from(new Set(hashes.flatMap((hash) => securityMetadata.keysEquivalences?.[hash] ?? [])))
    const directRetrievals = hashes.flatMap((hash) => {
      const retrievedMetadata = securityMetadata.secureDelegations?.[hash]
      return retrievedMetadata ? { canonicalKey: hash, secureDelegation: retrievedMetadata } : []
    })
    if (
      directRetrievals.length > 1 ||
      canonicalByEquivalences.length > 1 ||
      (!!canonicalByEquivalences[0] && !!directRetrievals[0]?.canonicalKey && canonicalByEquivalences[0] !== directRetrievals[0]?.canonicalKey)
    )
      throw new Error('Illegal state: multiple secure delegations matching equivalent hashes of entity.')
    const canonicalFromEquivalences = canonicalByEquivalences[0]
    const retrievedFromEquivalences = securityMetadata.secureDelegations?.[canonicalFromEquivalences]
    return (
      directRetrievals[0] ??
      (!!canonicalFromEquivalences && !!retrievedFromEquivalences
        ? { canonicalKey: canonicalFromEquivalences, secureDelegation: retrievedFromEquivalences }
        : undefined)
    )
  }
}
