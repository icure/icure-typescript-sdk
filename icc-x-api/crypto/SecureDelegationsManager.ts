import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { CryptoStrategies } from './CryptoStrategies'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { fingerprintV2, hexPublicKeysWithSha1Of, hexPublicKeysWithSha256Of } from './utils'
import { ExchangeDataManager } from './ExchangeDataManager'
import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { SecureDelegationsEncryption } from './SecureDelegationsEncryption'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua, ua2hex } from '../utils'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { EntityShareOrMetadataUpdateRequest } from '../../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { EntitySharedMetadataUpdateRequest } from '../../icc-api/model/requests/EntitySharedMetadataUpdateRequest'
import EntryUpdateTypeEnum = EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { SecurityMetadata } from '../../icc-api/model/SecurityMetadata'
import { ExchangeDataMapManager } from './ExchangeDataMapManager'

export class SecureDelegationsManager {
  constructor(
    private readonly exchangeDataManager: ExchangeDataManager,
    private readonly exchangeDataMapManager: ExchangeDataMapManager,
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
      availablePublicKeysHexWithSha1: string[]
      availablePublicKeysHexWithSha256: string[]
    }
  > = new LruTemporisedAsyncCache(100, () => 30 * 60 * 1000)

  /**
   * @param entity an entity, must already have secret foreign keys initialised.
   * @param entityType the type of the entity
   * @param secretIds the initial secret ids to include and share with the auto-delegations
   * @param owningEntityIds the initial owning entity ids to include and share with the auto-delegations
   * @param encryptionKeys the initial encryption keys to include and share with the auto-delegations
   * @param autoDelegations the data owners which will initially have access to the entity in addition to the current data owner and the access level
   * they will have on the entity.
   * @return the entity with the security metadata initialised for the provided parameters.
   */
  async entityWithInitialisedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T & { secretForeignKeys: string[] },
    entityType: EntityWithDelegationTypeName,
    secretIds: string[],
    owningEntityIds: string[],
    encryptionKeys: string[],
    autoDelegations: { [delegateId: string]: SecureDelegation.AccessLevelEnum }
  ): Promise<T> {
    const entityWithType: EncryptedEntityWithType = { entity, type: entityType }
    const rootDelegationInfo = await this.makeSecureDelegationInfo(
      entityWithType,
      await this.dataOwnerApi.getCurrentDataOwnerId(),
      secretIds,
      encryptionKeys,
      owningEntityIds,
      AccessLevelEnum.WRITE,
      undefined
    )
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const otherDelegationsInfo: {
      canonicalDelegationKey: string
      canonicalKey: string
      delegation: SecureDelegation
      delegationKeyEquivalences: { [p: string]: string }
      encryptedExchangeDataId: { [fp: string]: string } | undefined
    }[] = []
    for (const [delegateId, permissions] of Object.entries(autoDelegations)) {
      if (delegateId !== selfId) {
        otherDelegationsInfo.push(
          await this.makeSecureDelegationInfo(
            entityWithType,
            delegateId,
            secretIds,
            encryptionKeys,
            owningEntityIds,
            permissions,
            rootDelegationInfo.canonicalDelegationKey
          )
        )
      }
    }
    const secureDelegations = Object.fromEntries(
      [rootDelegationInfo, ...otherDelegationsInfo].map(({ canonicalDelegationKey, delegation }) => [canonicalDelegationKey, delegation])
    )
    const keysEquivalences = {
      ...rootDelegationInfo.delegationKeyEquivalences,
    }
    for (const { delegationKeyEquivalences: otherKeyEquivalences } of otherDelegationsInfo) {
      Object.assign(keysEquivalences, otherKeyEquivalences)
    }
    const newExchangeDataMaps = Object.fromEntries(
      otherDelegationsInfo
        .filter(({ encryptedExchangeDataId }) => !!encryptedExchangeDataId)
        .map(({ canonicalKey, encryptedExchangeDataId }) => [canonicalKey, encryptedExchangeDataId!])
    )
    await this.exchangeDataMapManager.createExchangeDataMaps(newExchangeDataMaps)
    return {
      ...entity,
      securityMetadata: new SecurityMetadata({ secureDelegations, keysEquivalences }),
    }
  }

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
    newDelegationPermissions: EntityShareRequest.RequestedPermissionInternal
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
      const accessControlKeys = (
        await this.accessControlSecretUtils.accessControlKeysFor(
          exchangeDataInfo.accessControlSecret,
          entityWithType.type,
          entityWithType.entity.secretForeignKeys ?? []
        )
      ).map((x) => ua2hex(x))
      return {
        share: await this.makeShareRequestParams(
          exchangeDataInfo,
          accessControlKeys,
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
    accessControlKeys: string[],
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[],
    newDelegationPermissions: EntityShareRequest.RequestedPermissionInternal
  ): Promise<EntityShareRequest> {
    return new EntityShareRequest({
      ...(await this.makeSecureDelegationEncryptedData(exchangeDataInfo, delegateId, shareSecretIds, shareEncryptionKeys, shareOwningEntityIds)),
      requestedPermissions: newDelegationPermissions,
      accessControlKeys,
    })
  }

  private async makeSecureDelegationInfo(
    entity: EncryptedEntityWithType,
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[],
    permissions: AccessLevelEnum,
    parentDelegationKey: string | undefined
  ): Promise<{
    canonicalDelegationKey: string
    canonicalKey: string
    delegation: SecureDelegation
    encryptedExchangeDataId: { [fp: string]: string } | undefined
    delegationKeyEquivalences: { [alias: string]: string }
  }> {
    // Be wary of explicit delegator and explicit delegate
    const exchangeDataInfo = await this.exchangeDataManager.getOrCreateEncryptionDataTo(
      delegateId,
      entity.type,
      entity.entity.secretForeignKeys ?? []
    )
    const accessControlHashes = await this.accessControlSecretUtils.secureDelegationKeysFor(
      exchangeDataInfo.accessControlSecret,
      entity.type,
      entity.entity.secretForeignKeys ?? []
    )
    const accessControlKeys = (
      await this.accessControlSecretUtils.accessControlKeysFor(
        exchangeDataInfo.accessControlSecret,
        entity.type,
        entity.entity.secretForeignKeys ?? []
      )
    ).map((x) => ua2hex(x))
    const accessControlKeysToHashes = accessControlKeys
      .map((key, index) => {
        return [key, accessControlHashes[index]]
      })
      .sort((a, b) => a[1].localeCompare(b[1]))

    const canonicalKey = accessControlKeysToHashes[0][1]
    const keyEquivalences = Object.fromEntries(accessControlKeysToHashes.slice(1).map((hash) => [hash[1], canonicalKey]))
    const encryptedDelegationInfo = await this.makeSecureDelegationEncryptedData(
      exchangeDataInfo,
      delegateId,
      shareSecretIds,
      shareEncryptionKeys,
      shareOwningEntityIds
    )
    const delegation = new SecureDelegation({
      delegator: encryptedDelegationInfo?.explicitDelegator,
      delegate: encryptedDelegationInfo?.explicitDelegate,
      secretIds: encryptedDelegationInfo?.secretIds,
      encryptionKeys: encryptedDelegationInfo?.encryptionKeys,
      owningEntityIds: encryptedDelegationInfo?.owningEntityIds,
      parentDelegations: parentDelegationKey ? [parentDelegationKey] : undefined,
      exchangeDataId: encryptedDelegationInfo?.exchangeDataId,
      encryptedExchangeDataId: encryptedDelegationInfo?.encryptedExchangeDataId,
      permissions: permissions,
    })
    return {
      canonicalDelegationKey: canonicalKey,
      canonicalKey: accessControlKeysToHashes[0][0],
      delegation,
      encryptedExchangeDataId: encryptedDelegationInfo?.encryptedExchangeDataId,
      delegationKeyEquivalences: keyEquivalences,
    }
  }

  private async makeSecureDelegationEncryptedData(
    exchangeDataInfo: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey },
    delegateId: string,
    shareSecretIds: string[],
    shareEncryptionKeys: string[],
    shareOwningEntityIds: string[]
  ): Promise<{
    explicitDelegator?: string
    explicitDelegate?: string
    secretIds?: string[]
    encryptionKeys?: string[]
    owningEntityIds?: string[]
    exchangeDataId?: string
    encryptedExchangeDataId?: { [fp: string]: string } // TODO if secure delegation info, check cache before calculating
  }> {
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const exchangeDataIdInfo =
      delegateId === selfId
        ? this.makeExchangeDataIdInfoForSelf(selfId, exchangeDataInfo.exchangeData)
        : await this.makeExchangeDataIdInfoForDelegate(selfId, delegateId, exchangeDataInfo.exchangeData)
    const encryptedSecretIds = await this.secureDelegationsEncryption.encryptSecretIds(shareSecretIds, exchangeDataInfo.exchangeKey)
    const encryptedEncryptionKeys = await this.secureDelegationsEncryption.encryptEncryptionKeys(shareEncryptionKeys, exchangeDataInfo.exchangeKey)
    const encryptedOwningEntityIds = await this.secureDelegationsEncryption.encryptOwningEntityIds(shareOwningEntityIds, exchangeDataInfo.exchangeKey)
    return {
      ...exchangeDataIdInfo,
      secretIds: encryptedSecretIds,
      encryptionKeys: encryptedEncryptionKeys,
      owningEntityIds: encryptedOwningEntityIds,
    }
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
      for (const keyHex of [...delegateInfo.availablePublicKeysHexWithSha1, ...delegateInfo.availablePublicKeysHexWithSha256]) {
        const currFp = fingerprintV2(keyHex)
        const shaVersion = delegateInfo.availablePublicKeysHexWithSha1.includes(keyHex) ? 'sha-1' : 'sha-256'
        if (fingerprintsOfVerifiedExchangeData.has(currFp)) {
          delegateVerifiedKeys[currFp] = await this.primitives.RSA.importKey('spki', hex2ua(keyHex), ['encrypt'], shaVersion)
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
      const dataOwnerWithType = await this.dataOwnerApi.getCryptoActorStub(dataOwnerId)
      return {
        item: {
          requiresAnonymousDelegations: this.cryptoStrategies.dataOwnerRequiresAnonymousDelegation(dataOwnerWithType),
          availablePublicKeysHexWithSha1: Array.from(hexPublicKeysWithSha1Of(dataOwnerWithType.stub)),
          availablePublicKeysHexWithSha256: Array.from(hexPublicKeysWithSha256Of(dataOwnerWithType.stub)),
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
