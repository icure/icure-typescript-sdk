import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import {
  b2a,
  decryptObject,
  EncryptedEntityWithType,
  EncryptedFieldsManifest,
  encryptObject,
  EntityWithDelegationTypeName,
  hex2ua,
  truncateTrailingNulls,
  ua2utf8,
  utf8_2ua,
} from '../utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { SecurityMetadataDecryptor, SecurityMetadataType } from './SecurityMetadataDecryptor'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { ExtendedApisUtils } from './ExtendedApisUtils'
import { EntityShareOrMetadataUpdateRequest } from '../../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../../icc-api/model/requests/EntityBulkShareResult'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { SecureDelegationsManager } from './SecureDelegationsManager'
import { ShareResult, ShareResultFailure, ShareResultSuccess } from '../utils/ShareResult'
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { IccUserXApi } from '../icc-user-x-api'
import { MinimalEntityBulkShareResult } from '../../icc-api/model/requests/MinimalEntityBulkShareResult'
import { BulkShareOrUpdateMetadataParams, EntityRequestInformation } from '../../icc-api/model/requests/BulkShareOrUpdateMetadataParams'
import * as _ from 'lodash'
import AccessLevel = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import RequestedPermissionInternal = EntityShareRequest.RequestedPermissionInternal
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

/**
 * @internal this class is for internal use only and may be changed without notice.
 * Methods to support extended apis.
 */
export class ExtendedApisUtilsImpl implements ExtendedApisUtils {
  constructor(
    private readonly primitives: CryptoPrimitives,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly securityMetadataDecryptor: SecurityMetadataDecryptor,
    private readonly secureDelegationsManager: SecureDelegationsManager,
    private readonly userApi: IccUserXApi,
    private readonly useParentKeys: boolean
  ) {}

  async encryptionKeysOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(dataOwnerId, (hierarchy) =>
      this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.EncryptionKey)
    )
  }

  async encryptionKeysForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy((hierarchy) =>
      this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.EncryptionKey)
    )
  }

  async secretIdsOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(dataOwnerId, (hierarchy) =>
      this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.SecretId)
    )
  }

  async secretIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy((hierarchy) => this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.SecretId))
  }

  async owningEntityIdsOf(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    return await this.decryptAndMergeHierarchy(dataOwnerId, (hierarchy) =>
      this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.OwningEntityId)
    )
  }

  async owningEntityIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]> {
    return this.decryptHierarchy((hierarchy) =>
      this.securityMetadataDecryptor.decryptAll(entity.entity, hierarchy, SecurityMetadataType.OwningEntityId)
    )
  }

  async hasWriteAccess(entity: EncryptedEntityWithType): Promise<boolean> {
    return (
      (await this.securityMetadataDecryptor.getEntityAccessLevel(entity.entity, await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())) ===
      AccessLevel.WRITE
    )
  }

  async entityWithInitialisedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    owningEntity: string | undefined,
    owningEntitySecretId: string | undefined,
    initialiseEncryptionKey: boolean,
    autoDelegations: { [p: string]: SecureDelegation.AccessLevelEnum }
  ): Promise<{ updatedEntity: T; rawEncryptionKey: string | undefined; secretId: string }> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithInitialisedEncryptedMetadata', arguments)
    this.checkEmptyEncryptionMetadata(entity)
    const newRawKey = initialiseEncryptionKey ? await this.primitives.AES.generateCryptoKey(true) : undefined
    const newSecretId = this.primitives.randomUuid()
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
        const existingDelegationMembersDetails = await this.securityMetadataDecryptor.getDelegationMemberDetails(entityWithType)
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
    delegates: {
      [p: string]: {
        shareSecretIds: string[] | undefined
        shareEncryptionKeys: ShareMetadataBehaviour | undefined
        shareOwningEntityIds: ShareMetadataBehaviour | undefined
        requestedPermissions: EntityShareRequest.RequestedPermissionEnum | undefined
      }
    },
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<EntityBulkShareResult<T>[]>
  ): Promise<ShareResult<T>> {
    const availableEncryptionKeys = await this.encryptionKeysOf(entity)
    const availableOwningEntityIds = await this.owningEntityIdsOf(entity)
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
      dataForDelegates[delegateId] = {
        shareSecretIds: delegateRequests.shareSecretIds ?? (await this.secretIdsOf(entity)),
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
    const legacySecretIds = await this.securityMetadataDecryptor.decryptAllLegacyDelegations(entity.entity, hierarchy, SecurityMetadataType.SecretId)
    const legacyEncryptionKeys = await this.securityMetadataDecryptor.decryptAllLegacyDelegations(
      entity.entity,
      hierarchy,
      SecurityMetadataType.OwningEntityId
    )
    const legacyOwningEntityIds = await this.securityMetadataDecryptor.decryptAllLegacyDelegations(
      entity.entity,
      hierarchy,
      SecurityMetadataType.OwningEntityId
    )
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
        : await this.securityMetadataDecryptor.getEntityLegacyDelegationAccessLevel(entity.entity, subHierarchy)
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
        (await this.securityMetadataDecryptor.decryptAllSecureDelegations(entity.entity, [currMemberId], SecurityMetadataType.SecretId)).map(
          (x) => x.decrypted
        )
      )
      missingSecretIds = selfLegacySecretIds.filter((x) => !currentSecretIds.has(x))
    }
    if (selfLegacyEncryptionKeys.length > 0) {
      const currentEncryptionKeys = new Set(
        (await this.securityMetadataDecryptor.decryptAllSecureDelegations(entity.entity, [currMemberId], SecurityMetadataType.EncryptionKey)).map(
          (x) => x.decrypted
        )
      )
      missingEncryptionKeys = selfLegacyEncryptionKeys.filter((x) => !currentEncryptionKeys.has(x))
    }
    if (selfLegacyOwningEntityIds.length > 0) {
      const currentOwningEntityIds = new Set(
        (await this.securityMetadataDecryptor.decryptAllSecureDelegations(entity.entity, [currMemberId], SecurityMetadataType.OwningEntityId)).map(
          (x) => x.decrypted
        )
      )
      missingOwningEntityIds = selfLegacyOwningEntityIds.filter((x) => !currentOwningEntityIds.has(x))
    }
    const mustCreateRootDelegation =
      selfId === entity.entity.id &&
      currMemberId === selfId &&
      !(await this.securityMetadataDecryptor.getEntitySecureDelegationAccessLevel(entity.entity, subHierarchy))
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
    const triedKeys: Set<string> = new Set()
    const result = await this.doIncrementallyDecryptingKeys(entity.entity, entity.type, async (e, t, keys) => {
      for (const k of keys) {
        if (!triedKeys.has(k.raw)) {
          triedKeys.add(k.raw)
          try {
            const decrypted = await this.primitives.AES.decrypt(k.key, content)
            if (!validator || (await validator(decrypted))) return { success: decrypted }
          } catch (e) {
            console.warn(`Error while attempting to decrypt attachment of ${entity.entity.id} with raw key ${k.raw}: ${e}`)
          }
        }
      }
      return null
    })
    if (result != null) {
      return { data: result.success, wasDecrypted: true }
    } else {
      return { data: content, wasDecrypted: false }
    }
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
    const encrypted = await this.doIncrementallyDecryptingKeys(entity, type, async (e, t, keys) => {
      for (const k of keys) {
        try {
          return {
            success: {
              encryptedData: await this.primitives.AES.encrypt(k.key, content),
              updatedEntity: updatedEntity,
            },
          }
        } catch (e) {
          console.warn(`Error while encrypting with raw key ${k.raw}: ${e}`)
        }
      }
      return null
    })
    if (encrypted != null) return encrypted.success
    throw new Error(`Could not extract any valid encryption keys for entity ${JSON.stringify(entity)}.`)
  }

  async tryDecryptEntities<T extends EncryptedEntity>(
    entities: T[],
    entityType: EntityWithDelegationTypeName,
    constructor: (json: any) => T
  ): Promise<{ entity: T; decrypted: boolean }[]> {
    const nothingToDecryptResults = new Map<string, T>()
    for (const entity of entities) {
      const nothingToDecrypt = await decryptObject(entity, async (encrypted) => {
        return null
      })
      if (nothingToDecrypt != null) {
        nothingToDecryptResults.set(entity.id!, constructor(nothingToDecrypt))
      }
    }
    const actuallyDecryptedResults = await this.doManyIncrementallyDecryptingKeys(
      entities.filter((e) => !nothingToDecryptResults.has(e.id!)),
      entityType,
      async (entity, t, keys) => {
        // The decrypt object will try all keys on each of the sub-objects; this is intentional because even though it
        // shouldn't happen, but it is still possible that some entity could be accidentally merged badly and the merged
        // entity has multiple encryptedSelf (on different sub-entities) that use different keys.
        const decrypted = await decryptObject(entity, (encrypted) => this.tryDecryptJson(keys, encrypted, false))
        if (decrypted != null) {
          return { success: constructor(decrypted) }
        } else {
          return null
        }
      }
    )
    const res = []
    for (const entity of entities) {
      const decrypted = actuallyDecryptedResults.get(entity.id!) ?? nothingToDecryptResults.get(entity.id!)
      if (!decrypted) {
        res.push({ entity: entity, decrypted: false })
      } else {
        res.push({ entity: decrypted, decrypted: true })
      }
    }
    return res
  }

  async tryDecryptJson(
    potentialKeys: { key: CryptoKey; raw: string }[],
    encrypted: Uint8Array,
    truncateTrailingDecryptedNulls: boolean
  ): Promise<{} | null> {
    for (const key of potentialKeys) {
      try {
        const decrypted = await this.primitives.AES.decrypt(key.key, encrypted, key.raw)
        return JSON.parse(ua2utf8(truncateTrailingDecryptedNulls ? truncateTrailingNulls(new Uint8Array(decrypted)) : decrypted))
      } catch (e) {}
    }
    return null
  }

  async tryEncryptEntities<T extends EncryptedEntity>(
    entities: T[],
    entityType: EntityWithDelegationTypeName,
    fieldsToEncrypt: EncryptedFieldsManifest,
    encodeBinaryData: boolean,
    requireEncryption: boolean,
    constructor: (json: any) => T
  ): Promise<T[]> {
    const entitiesWithInitialisedEncryptionKeys: T[] = []
    for (const entity of entities) {
      entitiesWithInitialisedEncryptionKeys.push((await this.ensureEncryptionKeysInitialised(entity, entityType)) ?? entity)
    }
    const results = await this.doManyIncrementallyDecryptingKeys(entitiesWithInitialisedEncryptionKeys, entityType, async (e, t, keys) => {
      for (const k of keys) {
        try {
          const encrypted = await encryptObject(
            e,
            (obj) => {
              // TODO encoding of binary data should probably be applied to everything?
              const json = encodeBinaryData
                ? JSON.stringify(obj, (k, v) => {
                    return v instanceof ArrayBuffer || ArrayBuffer.isView(v)
                      ? b2a(new Uint8Array(v as ArrayBufferLike).reduce((d, b) => d + String.fromCharCode(b), ''))
                      : v
                  })
                : JSON.stringify(obj)

              return this.primitives.AES.encrypt(k.key, utf8_2ua(json), k.raw)
            },
            fieldsToEncrypt,
            entityType
          )
          return { success: constructor(encrypted) }
        } catch (e) {
          console.warn(`Error while encrypting with raw key ${k.raw}: ${e}`)
        }
      }
      return null
    })
    if (results.size != entitiesWithInitialisedEncryptionKeys.length) {
      if (requireEncryption) {
        throw new Error(
          `Could not encrypt entities ${entitiesWithInitialisedEncryptionKeys.flatMap((e): string[] => (results.has(e.id!) ? [] : [e.id!]))}`
        )
      } else {
        for (const e of entitiesWithInitialisedEncryptionKeys) {
          if (!results.has(e.id!)) {
            await encryptObject(
              e,
              async (obj: { [key: string]: any }) => {
                const hasNonEmptyValues = Object.values(obj).some(
                  (v) => v !== undefined && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0) || Object.keys(v).length > 0)
                )
                if (hasNonEmptyValues) {
                  throw new Error(
                    `Impossible to modify encrypted content of an entity if no encryption key is known.\nEntity: ${JSON.stringify(
                      e
                    )}\nTo encrypt: ${JSON.stringify(obj)}`
                  )
                }
                return Promise.resolve(new ArrayBuffer(1))
              },
              fieldsToEncrypt,
              'entity'
            )
            results.set(e.id!, e)
          }
        }
      }
    }
    return entitiesWithInitialisedEncryptionKeys.map((e) => results.get(e.id!)!)
  }

  async ensureEncryptionKeysInitialised<T extends EncryptedEntity>(entity: T, entityType: EntityWithDelegationTypeName): Promise<T | undefined> {
    if (this.securityMetadataDecryptor.hasAnyEncryptionKeys(entity)) return undefined
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
    decryptedDataProvider: (dataOwners: string[]) => Promise<{ ownerId: string; extracted: string[] }[]>
  ): Promise<{ ownerId: string; extracted: string[] }[]> {
    const canDecryptOwnerIds = this.useParentKeys
      ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      : [await this.dataOwnerApi.getCurrentDataOwnerId()]
    return await decryptedDataProvider(canDecryptOwnerIds)
  }

  private async decryptAndMergeHierarchy(
    dataOwnerId: string | undefined,
    decryptedDataProvider: (dataOwners: string[]) => Promise<{ ownerId: string; extracted: string[] }[]>
  ): Promise<string[]> {
    const hierarchy = this.useParentKeys
      ? dataOwnerId
        ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(dataOwnerId)
        : await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      : [dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())]
    const decryptedData = await decryptedDataProvider(hierarchy)
    const merged = decryptedData.flatMap((x) => x.extracted)
    return this.deduplicate(merged)
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

  async doIncrementallyDecryptingKeys<E extends EncryptedEntity | EncryptedEntityStub, T>(
    entity: E,
    entityType: EntityWithDelegationTypeName,
    action: (entity: E, entityType: EntityWithDelegationTypeName, keys: { key: CryptoKey; raw: string }[]) => Promise<{ success: T } | null>
  ): Promise<{ success: T } | null> {
    const res = await this.doManyIncrementallyDecryptingKeys([entity], entityType, (e, t, ks) => action(e, t, ks))
    if (res.has(entity.id!)) {
      return { success: res.get(entity.id!)! }
    } else {
      return null
    }
  }

  async doManyIncrementallyDecryptingKeys<E extends EncryptedEntity | EncryptedEntityStub, T>(
    entities: E[],
    entitiesType: EntityWithDelegationTypeName,
    action: (entity: E, entityType: EntityWithDelegationTypeName, keys: { key: CryptoKey; raw: string }[]) => Promise<{ success: T } | null>
  ): Promise<Map<string, T>> {
    if (entities.length == 0) return new Map()
    if (new Set(entities.map((e) => e.id)).size != entities.length) {
      throw new Error(`Duplicate entries in entities ${entities.map((x) => x.id)}`)
    }
    const hierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const allExtractedKeysForEntities = Object.fromEntries(entities.map((x) => [x.id!, new Set<string>()] as [string, Set<string>]))
    const newlyExtractedKeysForEntities = Object.fromEntries(entities.map((x) => [x.id!, new Set<string>()] as [string, Set<string>]))
    const results = new Map<string, T>()
    const remainingEntitiesById = Object.fromEntries(entities.map((x) => [x.id!, x] as [string, E]))
    const importedKeysByRaw = new Map<string, CryptoKey>()
    const primitives = this.primitives

    async function updateExtractedKeysAndDoActionIfNecessary(
      newKeys: { [entityId: string]: string[] },
      forceUpdateOnEntitiesWithNewExtractedKeys: boolean
    ): Promise<void> {
      for (const [entityId, keys] of Object.entries(newKeys)) {
        const newlyExtractedSet = newlyExtractedKeysForEntities[entityId]
        const alreadyExtractedSet = allExtractedKeysForEntities[entityId]
        for (const k of keys) {
          if (!alreadyExtractedSet.has(k)) {
            newlyExtractedSet.add(k)
            if (!importedKeysByRaw.has(k)) {
              importedKeysByRaw.set(k, await primitives.AES.importKey('raw', hex2ua(k)))
            }
          }
        }
      }
      if (
        forceUpdateOnEntitiesWithNewExtractedKeys ||
        Object.keys(remainingEntitiesById).every((eId) => newlyExtractedKeysForEntities[eId].size > 0)
      ) {
        for (const entity of Object.values(remainingEntitiesById)) {
          const currId = entity.id!
          const currNewlyExtracted = newlyExtractedKeysForEntities[currId]
          if (currNewlyExtracted.size > 0) {
            const currAllExtracted = allExtractedKeysForEntities[currId]
            currNewlyExtracted.forEach((k) => currAllExtracted.add(k))
            currNewlyExtracted.clear()
            const actionResult = await action(
              entity,
              entitiesType,
              [...currAllExtracted].map((raw): { raw: string; key: CryptoKey } => ({
                raw: raw,
                key: importedKeysByRaw.get(raw)!,
              }))
            )
            if (actionResult != null) {
              delete remainingEntitiesById[currId]
              results.set(currId, actionResult.success)
            }
          }
        }
      }
    }

    await updateExtractedKeysAndDoActionIfNecessary(
      await this.securityMetadataDecryptor.decryptLegacyDelegations(
        Object.values(remainingEntitiesById),
        hierarchy,
        SecurityMetadataType.EncryptionKey
      ),
      false
    )
    if (Object.keys(remainingEntitiesById).length == 0) return results
    await updateExtractedKeysAndDoActionIfNecessary(
      await this.securityMetadataDecryptor.decryptSecureDelegationsUsingCache(
        Object.values(remainingEntitiesById),
        hierarchy,
        SecurityMetadataType.EncryptionKey
      ),
      false
    )
    if (Object.keys(remainingEntitiesById).length == 0) return results
    await updateExtractedKeysAndDoActionIfNecessary(
      await this.securityMetadataDecryptor.decryptSecureDelegationsUsingKnownExchangeData(
        Object.values(remainingEntitiesById),
        hierarchy,
        SecurityMetadataType.EncryptionKey
      ),
      false
    )
    if (Object.keys(remainingEntitiesById).length == 0) return results
    await updateExtractedKeysAndDoActionIfNecessary(
      await this.securityMetadataDecryptor.decryptSecureDelegationsUsingExchangeDataMap(
        Object.values(remainingEntitiesById),
        hierarchy,
        SecurityMetadataType.EncryptionKey
      ),
      false
    )
    if (Object.keys(remainingEntitiesById).length == 0) return results
    await updateExtractedKeysAndDoActionIfNecessary({}, true)
    return results
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
