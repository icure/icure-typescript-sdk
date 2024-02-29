import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { b2a, encryptObject, decryptObject, hex2ua, truncateTrailingNulls, ua2utf8, utf8_2ua, EncryptedFieldsManifest } from '../utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { asyncGeneratorToArray } from '../utils/collection-utils'
import { SecurityMetadataDecryptor, SecurityMetadataDecryptorChain } from './SecurityMetadataDecryptor'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { ExtendedApisUtils } from './ExtendedApisUtils'
import { EntityShareOrMetadataUpdateRequest } from '../../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../../icc-api/model/requests/EntityBulkShareResult'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { SecureDelegationsManager } from './SecureDelegationsManager'
import { LegacyDelegationSecurityMetadataDecryptor } from './LegacyDelegationSecurityMetadataDecryptor'
import { SecureDelegationsSecurityMetadataDecryptor } from './SecureDelegationsSecurityMetadataDecryptor'
import { ShareResult, ShareResultFailure, ShareResultSuccess } from '../utils/ShareResult'
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { IccUserXApi } from '../icc-user-x-api'
import { MinimalEntityBulkShareResult } from '../../icc-api/model/requests/MinimalEntityBulkShareResult'
import AccessLevel = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import RequestedPermissionInternal = EntityShareRequest.RequestedPermissionInternal
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { BulkShareOrUpdateMetadataParams, EntityRequestInformation } from '../../icc-api/model/requests/BulkShareOrUpdateMetadataParams'

/**
 * @internal this class is for internal use only and may be changed without notice.
 * Methods to support extended apis.
 */
export class ExtendedApisUtilsImpl implements ExtendedApisUtils {
  private readonly allSecurityMetadataDecryptor: SecurityMetadataDecryptor

  constructor(
    private readonly primitives: CryptoPrimitives,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly legacyDelMetadataDecryptor: LegacyDelegationSecurityMetadataDecryptor,
    private readonly secDelMetadataDecryptor: SecureDelegationsSecurityMetadataDecryptor,
    private readonly secureDelegationsManager: SecureDelegationsManager,
    private readonly userApi: IccUserXApi,
    private readonly useParentKeys: boolean
  ) {
    this.allSecurityMetadataDecryptor = new SecurityMetadataDecryptorChain([legacyDelMetadataDecryptor, secDelMetadataDecryptor])
  }

  async encryptionKeysOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(entity, dataOwnerId, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptEncryptionKeysOf(entityWithType, hierarchy)
    )
  }

  async encryptionKeysForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy(entity, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptEncryptionKeysOf(entityWithType, hierarchy)
    )
  }

  async secretIdsOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(entity, dataOwnerId, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptSecretIdsOf(entityWithType, hierarchy)
    )
  }

  async secretIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy(entity, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptSecretIdsOf(entityWithType, hierarchy)
    )
  }

  async owningEntityIdsOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(entity, dataOwnerId, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptOwningEntityIdsOf(entityWithType, hierarchy)
    )
  }

  async owningEntityIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy(entity, (entityWithType, hierarchy) =>
      this.allSecurityMetadataDecryptor.decryptOwningEntityIdsOf(entityWithType, hierarchy)
    )
  }

  async hasWriteAccess(entity: EncryptedEntityWithType): Promise<boolean> {
    return (
      (await this.allSecurityMetadataDecryptor.getEntityAccessLevel(entity, await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())) ===
      AccessLevel.WRITE
    )
  }

  async entityWithInitialisedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    owningEntity: string | undefined,
    owningEntitySecretId: string | undefined,
    initialiseEncryptionKey: boolean,
    initialiseSecretId: boolean,
    autoDelegations: { [p: string]: SecureDelegation.AccessLevelEnum }
  ): Promise<{ updatedEntity: T; rawEncryptionKey: string | undefined; secretId: string | undefined }> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithInitialisedEncryptedMetadata', arguments)
    this.checkEmptyEncryptionMetadata(entity)
    const newRawKey = initialiseEncryptionKey ? await this.primitives.AES.generateCryptoKey(true) : undefined
    const newSecretId = initialiseSecretId ? this.primitives.randomUuid() : undefined
    return {
      updatedEntity: await this.secureDelegationsManager.entityWithInitialisedEncryptedMetadata(
        {
          ...entity,
          secretForeignKeys: owningEntitySecretId ? [owningEntitySecretId] : [],
        },
        entityType,
        newSecretId ? [newSecretId] : [],
        !!owningEntity ? [owningEntity] : [],
        newRawKey ? [newRawKey] : [],
        autoDelegations
      ),
      rawEncryptionKey: newRawKey,
      secretId: newSecretId,
    }
  }

  async bulkShareOrUpdateEncryptedEntityMetadata<T extends EncryptedEntityStub>(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: {
      entity: EncryptedEntityStub
      dataForDelegates: {
        [delegateId: string]: {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
      }
    }[],
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<EntityBulkShareResult<T>[]>
  ): Promise<{
    updatedEntities: T[]
    unmodifiedEntitiesIds: string[]
    updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: RequestedPermissionEnum
      }
      updatedForMigration: boolean
      code?: number
      reason?: string
    }[]
  }> {
    const { allRequestsByEntityId, orderedRequestsInfoByEntityId, unmodifiedEntitiesIds } = await this.prepareBulkShareRequests(
      entitiesType,
      entitiesUpdates
    )
    const results = await doRequestBulkShareOrUpdate({ requestsByEntityId: allRequestsByEntityId })
    const updatedEntities: T[] = []
    const updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: RequestedPermissionEnum
      }
      updatedForMigration: boolean
      code?: number
      reason?: string
    }[] = []
    for (const result of results) {
      if (result.updatedEntity) {
        updatedEntities.push(result.updatedEntity)
      }
      for (const [errorRequestId, error] of Object.entries(result.rejectedRequests ?? {})) {
        const requestIndex = Number(errorRequestId)
        const { delegateId, request, updatedForMigration } = orderedRequestsInfoByEntityId[result.entityId][requestIndex]
        updateErrors.push({
          entityId: result.entityId,
          delegateId,
          request,
          updatedForMigration,
          code: error.code,
          reason: error.reason,
        })
      }
    }
    // TODO implement auto-retry for failed requests if the shouldRetry flag in result.rejectedRequests is set to true
    return {
      updatedEntities,
      updateErrors,
      unmodifiedEntitiesIds,
    }
  }

  async bulkShareOrUpdateEncryptedEntityMetadataNoEntities(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: {
      entity: EncryptedEntityStub
      dataForDelegates: {
        [delegateId: string]: {
          shareSecretIds: string[]
          shareEncryptionKeys: string[]
          shareOwningEntityIds: string[]
          requestedPermissions: EntityShareRequest.RequestedPermissionEnum
        }
      }
    }[],
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<MinimalEntityBulkShareResult[]>
  ): Promise<{
    unmodifiedEntitiesIds: string[]
    successfulUpdates: { entityId: string; delegateId: string }[]
    updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: EntityShareRequest.RequestedPermissionEnum
      }
      updatedForMigration: boolean
      code?: number
      reason?: string
    }[]
  }> {
    const { allRequestsByEntityId, orderedRequestsInfoByEntityId, unmodifiedEntitiesIds } = await this.prepareBulkShareRequests(
      entitiesType,
      entitiesUpdates
    )
    const results = await doRequestBulkShareOrUpdate({ requestsByEntityId: allRequestsByEntityId })
    const updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: RequestedPermissionEnum
      }
      updatedForMigration: boolean
      code?: number
      reason?: string
    }[] = []
    for (const result of results) {
      for (const [errorRequestId, error] of Object.entries(result.rejectedRequests ?? {})) {
        const requestIndex = Number(errorRequestId)
        const { delegateId, request, updatedForMigration } = orderedRequestsInfoByEntityId[result.entityId][requestIndex]
        updateErrors.push({
          entityId: result.entityId,
          delegateId,
          request,
          updatedForMigration,
          code: error.code,
          reason: error.reason,
        })
      }
    }
    const successfulRequests = Object.entries(allRequestsByEntityId)
      .flatMap(([entityId, requests]) => Object.keys(requests).map((delegateId) => ({ entityId, delegateId })))
      .filter(({ entityId, delegateId }) => !updateErrors.some((error) => error.entityId === entityId && error.delegateId === delegateId))
    return {
      successfulUpdates: successfulRequests,
      updateErrors,
      unmodifiedEntitiesIds,
    }
  }

  private async prepareBulkShareRequests(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: {
      entity: EncryptedEntityStub
      dataForDelegates: {
        [delegateId: string]: {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
      }
    }[]
  ): Promise<{
    unmodifiedEntitiesIds: string[]
    allRequestsByEntityId: { [entityId: string]: EntityRequestInformation }
    orderedRequestsInfoByEntityId: {
      [entityId: string]: {
        delegateId: string
        request?: {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
        updatedForMigration: boolean
      }[]
    }
  }> {
    if (new Set(entitiesUpdates.map((e) => e.entity.id)).size !== entitiesUpdates.length) {
      throw new Error('Duplicate requests: the same entity id is present more than once in the input')
    }
    const allRequestsByEntityId = {} as { [entityId: string]: EntityRequestInformation }
    const orderedRequestsInfoByEntityId: {
      [entityId: string]: {
        delegateId: string
        request?: {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
        updatedForMigration: boolean
      }[]
    } = {}
    const unmodifiedEntitiesIds: string[] = []
    for (const { entity, dataForDelegates } of entitiesUpdates) {
      const entityId = entity.id
      if (!entityId) throw new Error('Share of an entity requires for the entity to already exist and have an id')
      const entityWithType = { entity, type: entitiesType }
      const currentRequests = {} as { [requestId: string]: EntityShareOrMetadataUpdateRequest }
      const currentOrderedRequests: {
        delegateId: string
        request?: {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
        updatedForMigration: boolean
      }[] = []
      const migrationRequests = await this.makeMigrationRequestsIfNeeded(entityWithType, dataForDelegates)
      for (const [delegate, request] of Object.entries(migrationRequests)) {
        currentRequests[String(currentOrderedRequests.length)] = request
        currentOrderedRequests.push({
          delegateId: delegate,
          request: dataForDelegates[delegate],
          updatedForMigration: true,
        })
      }
      for (const [delegate, userRequest] of Object.entries(dataForDelegates)) {
        if (!migrationRequests[delegate]) {
          const request = await this.secureDelegationsManager.makeShareOrUpdateRequestParams(
            entityWithType,
            delegate,
            userRequest.shareSecretIds ?? [],
            userRequest.shareEncryptionKeys ?? [],
            userRequest.shareOwningEntityIds ?? [],
            userRequest.requestedPermissions
          )
          if (request) {
            currentRequests[String(currentOrderedRequests.length)] = request
            currentOrderedRequests.push({
              delegateId: delegate,
              request: userRequest,
              updatedForMigration: false,
            })
          }
        }
      }
      if (Object.keys(currentRequests).length > 0) {
        const existingDelegationMembersDetails = await this.secDelMetadataDecryptor.getDelegationMemberDetails(entityWithType)
        const accessibleMembers = new Set(
          this.useParentKeys ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds() : [await this.dataOwnerApi.getCurrentDataOwnerId()]
        )
        const potentialParentDelegations = Object.entries(existingDelegationMembersDetails).flatMap(([k, members]) => {
          if ((!!members.delegate && accessibleMembers.has(members.delegate)) || (!!members.delegator && accessibleMembers.has(members.delegator))) {
            return [k]
          } else return []
        })
        allRequestsByEntityId[entityId] = { requests: currentRequests, potentialParentDelegations }
        orderedRequestsInfoByEntityId[entityId] = currentOrderedRequests
      } else {
        unmodifiedEntitiesIds.push(entityId)
      }
    }
    return { unmodifiedEntitiesIds, allRequestsByEntityId, orderedRequestsInfoByEntityId }
  }

  async simpleShareOrUpdateEncryptedEntityMetadata<T extends EncryptedEntityStub>(
    entity: { entity: T; type: EntityWithDelegationTypeName },
    unusedSecretIds: boolean,
    delegates: {
      [delegateId: string]: {
        shareSecretIds: string[] | undefined
        shareEncryptionKeys: ShareMetadataBehaviour | undefined
        shareOwningEntityIds: ShareMetadataBehaviour | undefined
        requestedPermissions: RequestedPermissionEnum | undefined
      }
    },
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<EntityBulkShareResult<T>[]>
  ): Promise<ShareResult<T>> {
    const availableEncryptionKeys = await this.encryptionKeysOf(entity)
    const availableOwningEntityIds = await this.owningEntityIdsOf(entity)
    let availableSecretIds: string[] | undefined
    if (unusedSecretIds) {
      availableSecretIds = await this.secretIdsOf(entity)
    }
    const dataForDelegates: {
      [delegateId: string]: {
        shareSecretIds: string[]
        shareEncryptionKeys: string[]
        shareOwningEntityIds: string[]
        requestedPermissions: RequestedPermissionEnum
      }
    } = {}
    for (const [delegateId, delegateRequests] of Object.entries(delegates)) {
      if (!availableEncryptionKeys.length && delegateRequests.shareEncryptionKeys === ShareMetadataBehaviour.REQUIRED) {
        throw new Error(
          `Entity ${JSON.stringify(
            entity
          )} has no encryption keys or the current data owner can't access any encryption keys, but sharing is required.`
        )
      }
      if (!availableOwningEntityIds.length && delegateRequests.shareOwningEntityIds === ShareMetadataBehaviour.REQUIRED) {
        throw new Error(
          `Entity ${JSON.stringify(
            entity
          )} has no owning entity ids or the current data owner can't access any owning entity ids, but sharing is required.`
        )
      }
      if (!delegateRequests.shareSecretIds && !unusedSecretIds) {
        throw new Error(`Share secret ids parameter is mandatory for entities of type ${entity.type}.`)
      } else if (delegateRequests.shareSecretIds && unusedSecretIds) {
        throw new Error(`Share secret ids parameter must not be unused with entities of type ${entity.type}.`)
      }
      dataForDelegates[delegateId] = {
        shareSecretIds: delegateRequests.shareSecretIds ?? availableSecretIds!,
        shareEncryptionKeys: delegateRequests.shareEncryptionKeys === ShareMetadataBehaviour.NEVER ? [] : availableEncryptionKeys,
        shareOwningEntityIds: delegateRequests.shareOwningEntityIds === ShareMetadataBehaviour.NEVER ? [] : availableOwningEntityIds,
        requestedPermissions: delegateRequests.requestedPermissions ?? RequestedPermissionEnum.MAX_WRITE,
      }
    }
    const shareResult = await this.bulkShareOrUpdateEncryptedEntityMetadata(
      entity.type,
      [
        {
          entity: entity.entity,
          dataForDelegates,
        },
      ],
      (x) => doRequestBulkShareOrUpdate(x)
    )
    if (shareResult.unmodifiedEntitiesIds.includes(entity.entity.id!)) {
      return new ShareResultSuccess(entity.entity)
    }
    if (!shareResult.updateErrors.length && shareResult.updatedEntities.length === 1) {
      return new ShareResultSuccess(shareResult.updatedEntities[0])
    }
    const requestedDelegates = new Set(Object.keys(delegates))
    const errorsOfRequestedDelegates = shareResult.updateErrors.filter((x) => requestedDelegates.has(x.delegateId))
    if (errorsOfRequestedDelegates.length === 0 && shareResult.updatedEntities.length === 1) {
      console.warn(`Errors with migration of encrypted metadata ${JSON.stringify(shareResult.updateErrors)}.`)
      return new ShareResultSuccess(shareResult.updatedEntities[0])
    }
    return new ShareResultFailure(
      shareResult.updateErrors,
      `There was an error sharing entity with id ${entity.entity.id}. Check the logs for more details.`
    )
  }

  private async makeMigrationRequestsIfNeeded(
    entity: EncryptedEntityWithType,
    userRequestsForEntity: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: RequestedPermissionEnum
      }
    }
  ): Promise<{ [delegateId: string]: EntityShareOrMetadataUpdateRequest }> {
    const hierarchy = this.useParentKeys
      ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      : [await this.dataOwnerApi.getCurrentDataOwnerId()]
    const legacySecretIds = await asyncGeneratorToArray(this.legacyDelMetadataDecryptor.decryptSecretIdsOf(entity, hierarchy))
    const legacyEncryptionKeys = await asyncGeneratorToArray(this.legacyDelMetadataDecryptor.decryptEncryptionKeysOf(entity, hierarchy))
    const legacyOwningEntityIds = await asyncGeneratorToArray(this.legacyDelMetadataDecryptor.decryptOwningEntityIdsOf(entity, hierarchy))
    const res = {} as { [delegateId: string]: EntityShareOrMetadataUpdateRequest }
    const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
    for (const hierarchyMember of hierarchy) {
      const hierarchyMemberMigration = await this.makeMigrationRequestForMemberOfHierarchy(
        entity,
        selfId,
        hierarchyMember,
        userRequestsForEntity[hierarchyMember],
        legacySecretIds,
        legacyEncryptionKeys,
        legacyOwningEntityIds
      )
      if (hierarchyMemberMigration) {
        res[hierarchyMember] = hierarchyMemberMigration
      }
    }
    return res
  }

  private async makeMigrationRequestForMemberOfHierarchy(
    entity: EncryptedEntityWithType,
    selfId: string,
    currMemberId: string,
    userRequestForDelegate:
      | {
          shareSecretIds?: string[]
          shareEncryptionKeys?: string[]
          shareOwningEntityIds?: string[]
          requestedPermissions: RequestedPermissionEnum
        }
      | undefined,
    legacySecretIds: { decrypted: string; dataOwnersWithAccess: string[] }[],
    legacyEncryptionKeys: { decrypted: string; dataOwnersWithAccess: string[] }[],
    legacyOwningEntityIds: { decrypted: string; dataOwnersWithAccess: string[] }[]
  ): Promise<EntityShareOrMetadataUpdateRequest | undefined> {
    // This implementation is very specific from migration from delegations to secure delegations. If in future we will have to migrate from secure delegations to something else, this method may need significant changes in its logic.
    const subHierarchy = this.useParentKeys ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(currMemberId) : [currMemberId]
    const subHierarchySet = new Set(subHierarchy)
    const legacyAccess =
      selfId === entity.entity.id && currMemberId === selfId
        ? AccessLevel.WRITE
        : await this.legacyDelMetadataDecryptor.getEntityAccessLevel(entity, subHierarchy)
    if (!legacyAccess) return undefined
    const selfLegacySecretIds = legacySecretIds.filter((x) => x.dataOwnersWithAccess.some((d) => subHierarchySet.has(d))).map((x) => x.decrypted)
    const selfLegacyEncryptionKeys = legacyEncryptionKeys
      .filter((x) => x.dataOwnersWithAccess.some((d) => subHierarchySet.has(d)))
      .map((x) => x.decrypted)
    const selfLegacyOwningEntityIds = legacyOwningEntityIds
      .filter((x) => x.dataOwnersWithAccess.some((d) => subHierarchySet.has(d)))
      .map((x) => x.decrypted)
    let missingSecretIds: string[] = []
    let missingEncryptionKeys: string[] = []
    let missingOwningEntityIds: string[] = []
    if (selfLegacySecretIds.length > 0) {
      const currentSecretIds = new Set(
        (await asyncGeneratorToArray(this.secDelMetadataDecryptor.decryptSecretIdsOf(entity, [currMemberId]))).map((x) => x.decrypted)
      )
      missingSecretIds = selfLegacySecretIds.filter((x) => !currentSecretIds.has(x))
    }
    if (selfLegacyEncryptionKeys.length > 0) {
      const currentEncryptionKeys = new Set(
        (await asyncGeneratorToArray(this.secDelMetadataDecryptor.decryptEncryptionKeysOf(entity, [currMemberId]))).map((x) => x.decrypted)
      )
      missingEncryptionKeys = selfLegacyEncryptionKeys.filter((x) => !currentEncryptionKeys.has(x))
    }
    if (selfLegacyOwningEntityIds.length > 0) {
      const currentOwningEntityIds = new Set(
        (await asyncGeneratorToArray(this.secDelMetadataDecryptor.decryptOwningEntityIdsOf(entity, [currMemberId]))).map((x) => x.decrypted)
      )
      missingOwningEntityIds = selfLegacyOwningEntityIds.filter((x) => !currentOwningEntityIds.has(x))
    }
    const mustCreateRootDelegation =
      selfId === entity.entity.id && currMemberId === selfId && !(await this.secDelMetadataDecryptor.getEntityAccessLevel(entity, subHierarchy))
    if (missingSecretIds.length > 0 || missingEncryptionKeys.length > 0 || missingOwningEntityIds.length > 0 || mustCreateRootDelegation) {
      let requestedPermissions: RequestedPermissionInternal
      if (currMemberId === selfId) {
        requestedPermissions = RequestedPermissionInternal.ROOT
      } else {
        requestedPermissions = RequestedPermissionInternal.FULL_WRITE // Legacy permission if present is always write
      }
      return await this.secureDelegationsManager.makeShareOrUpdateRequestParams(
        entity,
        currMemberId,
        Array.from(new Set([...missingSecretIds, ...(userRequestForDelegate?.shareSecretIds ?? [])])),
        Array.from(new Set([...missingEncryptionKeys, ...(userRequestForDelegate?.shareEncryptionKeys ?? [])])),
        Array.from(new Set([...missingOwningEntityIds, ...(userRequestForDelegate?.shareOwningEntityIds ?? [])])),
        requestedPermissions
      )
    } else return undefined
  }

  async tryDecryptDataOf(
    entity: EncryptedEntityWithType,
    content: ArrayBuffer | Uint8Array,
    validator: (decryptedData: ArrayBuffer) => Promise<boolean> | undefined
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    const decryptedKeys = this.allSecurityMetadataDecryptor.decryptEncryptionKeysOf(entity, [await this.dataOwnerApi.getCurrentDataOwnerId()])
    const triedKeys: Set<string> = new Set()
    let latest = await decryptedKeys.next()
    while (!latest.done) {
      if (!triedKeys.has(latest.value.decrypted)) {
        triedKeys.add(latest.value.decrypted)
        try {
          const decrypted = await this.primitives.AES.decryptWithRawKey(latest.value.decrypted, content)
          if (!validator || (await validator(decrypted))) return { data: decrypted, wasDecrypted: true }
        } catch (e) {
          console.warn(`Error while decrypting with raw key ${latest.value}: ${e}`)
        }
      }
      latest = await decryptedKeys.next()
    }
    return { data: content, wasDecrypted: false }
  }

  async encryptDataOf<T extends EncryptedEntityStub>(
    entity: T,
    type: EntityWithDelegationTypeName,
    content: ArrayBuffer | Uint8Array,
    saveEntity: (entity: T) => Promise<T>
  ): Promise<{ encryptedData: ArrayBuffer; updatedEntity: T | undefined }> {
    const ensureInitialisedKeysResult = await this.ensureEncryptionKeysInitialised(entity, type)
    let updatedEntity: T | undefined
    if (!!ensureInitialisedKeysResult) {
      updatedEntity = await saveEntity(ensureInitialisedKeysResult)
    }
    const decryptedKeys = this.allSecurityMetadataDecryptor.decryptEncryptionKeysOf({ entity: updatedEntity ?? entity, type }, [
      await this.dataOwnerApi.getCurrentDataOwnerId(),
    ])
    let latest = await decryptedKeys.next()
    while (!latest.done) {
      try {
        return { encryptedData: await this.primitives.AES.encryptWithRawKey(latest.value.decrypted, content), updatedEntity: updatedEntity }
      } catch (e) {
        console.warn(`Error while encrypting with raw key ${latest.value}: ${e}`)
      }
      latest = await decryptedKeys.next()
    }
    throw new Error(`Could not extract any valid encryption keys for entity ${JSON.stringify(entity)}.`)
  }

  async decryptEntity<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    constructor: (json: any) => T
  ): Promise<{ entity: T; decrypted: boolean }> {
    if (!entity.encryptedSelf) return { entity, decrypted: true }
    const encryptionKeys = await this.decryptAndImportAllDecryptionKeys({ entity: entity, type: entityType })
    if (!encryptionKeys.length) return { entity, decrypted: false }
    return {
      entity: constructor(
        await decryptObject(entity, async (encrypted) => {
          return (await this.tryDecryptJson(encryptionKeys, encrypted, false)) ?? {}
        })
      ),
      decrypted: true,
    }
  }

  async tryDecryptJson(
    potentialKeys: { key: CryptoKey; raw: string }[],
    encrypted: Uint8Array,
    truncateTrailingDecryptedNulls: boolean
  ): Promise<{} | undefined> {
    for (const key of potentialKeys) {
      try {
        const decrypted = (await this.primitives.AES.decrypt(key.key, encrypted, key.raw)) ?? encrypted
        return JSON.parse(ua2utf8(truncateTrailingDecryptedNulls ? truncateTrailingNulls(new Uint8Array(decrypted)) : decrypted))
      } catch (e) {}
    }
    return undefined
  }

  async tryEncryptEntity<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    fieldsToEncrypt: EncryptedFieldsManifest,
    encodeBinaryData: boolean,
    requireEncryption: boolean,
    constructor: (json: any) => T
  ): Promise<T> {
    const entityWithInitialisedEncryptionKeys = await this.ensureEncryptionKeysInitialised(entity, entityType)
    const updatedEntity = entityWithInitialisedEncryptionKeys ? entityWithInitialisedEncryptionKeys : entity
    const encryptionKey = await this.tryImportFirstValidKey({ entity, type: entityType })
    if (!!encryptionKey) {
      return constructor(
        await encryptObject(
          updatedEntity,
          (obj) => {
            // TODO should encoding of binary data should probably be applied to everything?
            const json = encodeBinaryData
              ? JSON.stringify(obj, (k, v) => {
                  return v instanceof ArrayBuffer || ArrayBuffer.isView(v)
                    ? b2a(new Uint8Array(v as ArrayBufferLike).reduce((d, b) => d + String.fromCharCode(b), ''))
                    : v
                })
              : JSON.stringify(obj)
            return this.primitives.AES.encrypt(encryptionKey.key, utf8_2ua(json), encryptionKey.raw)
          },
          fieldsToEncrypt,
          entityType
        )
      )
    } else if (requireEncryption) {
      throw new Error(`No key found for encryption of entity ${entity}`)
    } else {
      await encryptObject(
        entity,
        async (obj: { [key: string]: any }) => {
          const hasNonEmptyValues = Object.values(obj).some(
            (v) => v !== undefined && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0) || Object.keys(v).length > 0)
          )
          if (hasNonEmptyValues) {
            throw new Error(
              `Impossible to modify encrypted content of an entity if no encryption key is known.\nEntity: ${JSON.stringify(
                entity
              )}\nTo encrypt: ${JSON.stringify(obj)}`
            )
          }
          return Promise.resolve(new ArrayBuffer(1))
        },
        fieldsToEncrypt,
        'entity'
      )
      return entity
    }
  }

  async ensureEncryptionKeysInitialised<T extends EncryptedEntity>(entity: T, entityType: EntityWithDelegationTypeName): Promise<T | undefined> {
    if (this.allSecurityMetadataDecryptor.hasAnyEncryptionKeys(entity)) return undefined
    if (!entity.rev) {
      throw new Error(
        'New encrypted entity is lacking encryption metadata. ' +
          'Please instantiate new entities using the `newInstance` method from the respective extended api.'
      )
    }
    /*
     * Add encryption key and share with all auto-delegates already in legacy delegations.
     * TODO disable this logic and simply throw error for post-2018 customers.
     */
    const existingDelegations = new Set(Object.keys(entity.delegations ?? {}))
    const usersWithAccessToNewKey = Object.fromEntries(
      Object.values((await this.userApi.getCurrentUser()).autoDelegations ?? {})
        .flatMap((x) => x)
        .filter((x) => existingDelegations.has(x))
        .map((x) => [x, AccessLevelEnum.WRITE])
    )
    return await this.secureDelegationsManager.entityWithInitialisedEncryptedMetadata(
      {
        ...entity,
        secretForeignKeys: entity.secretForeignKeys ?? [],
      },
      entityType,
      [],
      [],
      [await this.primitives.AES.generateCryptoKey(true)],
      usersWithAccessToNewKey
    )
  }

  private async decryptHierarchy(
    entity: EncryptedEntityWithType,
    decryptedDataGeneratorProvider: (
      entityWithType: EncryptedEntityWithType,
      dataOwners: string[]
    ) => AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never>
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    const canDecryptOwnerIds = this.useParentKeys
      ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      : [await this.dataOwnerApi.getCurrentDataOwnerId()]
    const decryptedData = await asyncGeneratorToArray(decryptedDataGeneratorProvider(entity, canDecryptOwnerIds))
    return canDecryptOwnerIds.map((ownerId) => {
      const extracted = this.deduplicate(decryptedData.filter((x) => x.dataOwnersWithAccess.some((o) => o === ownerId)).map((x) => x.decrypted))
      return { ownerId, extracted }
    })
  }

  private async decryptAndMergeHierarchy(
    entity: EncryptedEntityWithType,
    dataOwnerId: string | undefined,
    decryptedDataGeneratorProvider: (
      entityWithType: EncryptedEntityWithType,
      dataOwners: string[]
    ) => AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never>
  ): Promise<string[]> {
    const hierarchy = this.useParentKeys
      ? dataOwnerId
        ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(dataOwnerId)
        : await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      : [dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())]
    const decryptedData = await asyncGeneratorToArray(decryptedDataGeneratorProvider(entity, hierarchy))
    return this.deduplicate(decryptedData.map((x) => x.decrypted))
  }

  private async tryImportKey(key: string): Promise<CryptoKey | undefined> {
    if (!/^[0-9A-Fa-f\-]+$/g.test(key)) return undefined
    try {
      return await this.primitives.AES.importKey('raw', hex2ua(key.replace(/-/g, '')))
    } catch (e) {
      console.warn(`Could not import key ${key} as an encryption key.`, e)
      return undefined
    }
  }

  async decryptAndImportAllDecryptionKeys(entity: EncryptedEntityWithType): Promise<{ key: CryptoKey; raw: string }[]> {
    const keys = this.allSecurityMetadataDecryptor.hasAnyEncryptionKeys(entity.entity)
      ? await this.encryptionKeysOf(entity)
      : this.deduplicate(
          await asyncGeneratorToArray(
            this.legacyDelMetadataDecryptor.decryptSecretIdsOf(entity, await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())
          ).then((secretIdsInfo) => secretIdsInfo.map(({ decrypted }) => decrypted))
        )
    const res = []
    for (const key of keys) {
      const imported = await this.tryImportKey(key)
      if (imported) res.push({ key: imported, raw: key })
    }
    return res
  }

  async decryptAndImportAnyEncryptionKey(entity: EncryptedEntityWithType): Promise<{ key: CryptoKey; raw: string }> {
    const res = await this.tryImportFirstValidKey(entity)
    if (!res) throw new Error(`Could not find any valid key for entity ${entity.entity.id} (${entity.type}).`)
    return res
  }

  private async tryImportFirstValidKey(entity: EncryptedEntityWithType): Promise<{ key: CryptoKey; raw: string } | undefined> {
    const generator = this.allSecurityMetadataDecryptor.decryptEncryptionKeysOf(entity, await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())
    let latest = await generator.next()
    while (!latest.done) {
      const imported = await this.tryImportKey(latest.value.decrypted)
      if (imported) return { key: imported, raw: latest.value.decrypted }
      latest = await generator.next()
    }
    return undefined
  }

  private deduplicate<T>(values: T[]): T[] {
    return [...new Set(values)]
  }

  private throwDetailedExceptionForInvalidParameter(argName: string, argValue: any, methodName: string, methodArgs: IArguments) {
    if (argValue) return

    let details = '\nMethod name: icc-crypto-x-api.' + methodName + '()\nArguments:'

    if (methodArgs) {
      try {
        const argsArray = [...methodArgs]
        argsArray.forEach((arg, index) => (details += '\n[' + index + ']: ' + JSON.stringify(arg)))
      } catch (ex) {
        details += '; a problem occured while logging arguments details: ' + ex
      }
    }

    throw new Error('### THIS SHOULD NOT HAPPEN: ' + argName + ' has an invalid value: ' + argValue + details)
  }

  private checkEmptyEncryptionMetadata(entity: EncryptedEntity) {
    this.doCheckEmptyEncryptionMetadata(entity, true)
  }

  hasEmptyEncryptionMetadata(entity: EncryptedEntity): boolean {
    return this.doCheckEmptyEncryptionMetadata(entity, false)
  }

  private doCheckEmptyEncryptionMetadata(entity: EncryptedEntity, throwErrorIfNonEmpty: boolean): boolean {
    const existingMetadata = []
    if (entity.delegations && Object.keys(entity.delegations).length) existingMetadata.push('delegations')
    if (entity.cryptedForeignKeys && Object.keys(entity.cryptedForeignKeys).length) existingMetadata.push('cryptedForeignKeys')
    if (entity.encryptionKeys && Object.keys(entity.encryptionKeys).length) existingMetadata.push('encryptionKeys')
    if (entity.secretForeignKeys && entity.secretForeignKeys.length) existingMetadata.push('secretForeignKeys')
    if (entity.securityMetadata && Object.keys(entity.securityMetadata).length) existingMetadata.push('securityMetadata')
    if (existingMetadata.length > 0) {
      if (throwErrorIfNonEmpty) {
        throw new Error(
          `Entity should have no encryption metadata on initialisation, but the following fields already have some values: ${existingMetadata}\n` +
            JSON.stringify(entity, undefined, 2)
        )
      } else return false
    }
    return true
  }
}
