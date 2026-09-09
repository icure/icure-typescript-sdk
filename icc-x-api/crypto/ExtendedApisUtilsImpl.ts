import { EncryptedEntity, EncryptedEntityStub, IcureStub } from '../../icc-api/model/models'
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
  ua2ab,
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
import AccessLevel = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import RequestedPermissionInternal = EntityShareRequest.RequestedPermissionInternal
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { SecretIdUseOption } from './SecretIdUseOption'
import { SecretIdShareOptions } from './ShareSecretIdOptions'
import {
  FailedRequestDetails,
  ShareByIdResult,
  ShareRequestPurpose,
  ShareRequestSummary,
  SharedSecretIdsSource,
  SuccessfulRequestDetails,
} from '../utils/ShareByIdResult'

type ResolvedShareRequestsForDelegates = {
  [delegateId: string]: {
    shareSecretIds: string[]
    shareEncryptionKeys: string[]
    shareOwningEntityIds: string[]
    requestedPermissions: RequestedPermissionEnum
  }
}

type BulkShareSuccessfulUpdate = {
  entityId: string
  delegateId: string
  purpose: ShareRequestPurpose
}

type BulkShareUpdateError = {
  entityId: string
  delegateId: string
  request?: {
    shareSecretIds?: string[]
    shareEncryptionKeys?: string[]
    shareOwningEntityIds?: string[]
    requestedPermissions: RequestedPermissionEnum
  }
  purpose: ShareRequestPurpose
  code?: number
  reason?: string
  shouldRetry: boolean
}

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
    owningEntitySecretIds: string[] | undefined,
    initialiseEncryptionKey: boolean,
    autoDelegations: { [p: string]: SecureDelegation.AccessLevelEnum },
    alternateRootDelegation: string | undefined
  ): Promise<{ updatedEntity: T; rawEncryptionKey: string | undefined; secretId: string }> {
    this.throwDetailedExceptionForInvalidParameter('entity.id', entity.id, 'entityWithInitialisedEncryptedMetadata', arguments)
    this.checkEmptyEncryptionMetadata(entity)
    const newRawKey = initialiseEncryptionKey ? await this.primitives.AES.generateCryptoKey(true) : undefined
    const newSecretId = this.primitives.randomUuid()
    return {
      updatedEntity: await this.secureDelegationsManager.entityWithInitialisedEncryptedMetadata(
        {
          ...entity,
          secretForeignKeys: owningEntitySecretIds ?? [],
        },
        entityType,
        newSecretId ? [newSecretId] : [],
        !!owningEntity ? [owningEntity] : [],
        newRawKey ? [newRawKey] : [],
        autoDelegations,
        alternateRootDelegation
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
      purpose: ShareRequestPurpose
      code?: number
      reason?: string
    }[]
  }> {
    const { allRequestsByEntityId, orderedRequestsInfoByEntityId, unmodifiedEntitiesIds } = await this.prepareBulkShareRequests(
      entitiesType,
      entitiesUpdates
    )
    const results =
      Object.keys(allRequestsByEntityId).length > 0 ? await doRequestBulkShareOrUpdate({ requestsByEntityId: allRequestsByEntityId }) : []
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
      purpose: ShareRequestPurpose
      code?: number
      reason?: string
    }[] = []
    for (const result of results) {
      if (result.updatedEntity) {
        updatedEntities.push(result.updatedEntity)
      }
      for (const [errorRequestId, error] of Object.entries(result.rejectedRequests ?? {})) {
        const requestIndex = Number(errorRequestId)
        const { delegateId, request, purpose } = orderedRequestsInfoByEntityId[result.entityId][requestIndex]
        updateErrors.push({
          entityId: result.entityId,
          delegateId,
          request,
          purpose,
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
    successfulUpdates: { entityId: string; delegateId: string; purpose: ShareRequestPurpose }[]
    updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: EntityShareRequest.RequestedPermissionEnum
      }
      purpose: ShareRequestPurpose
      code?: number
      reason?: string
      shouldRetry: boolean
    }[]
  }> {
    const { allRequestsByEntityId, orderedRequestsInfoByEntityId, unmodifiedEntitiesIds } = await this.prepareBulkShareRequests(
      entitiesType,
      entitiesUpdates
    )
    const results =
      Object.keys(allRequestsByEntityId).length > 0 ? await doRequestBulkShareOrUpdate({ requestsByEntityId: allRequestsByEntityId }) : []
    const updateErrors: {
      entityId: string
      delegateId: string
      request?: {
        shareSecretIds?: string[]
        shareEncryptionKeys?: string[]
        shareOwningEntityIds?: string[]
        requestedPermissions: RequestedPermissionEnum
      }
      purpose: ShareRequestPurpose
      code?: number
      reason?: string
      shouldRetry: boolean
    }[] = []
    for (const result of results) {
      for (const [errorRequestId, error] of Object.entries(result.rejectedRequests ?? {})) {
        const requestIndex = Number(errorRequestId)
        const { delegateId, request, purpose } = orderedRequestsInfoByEntityId[result.entityId][requestIndex]
        updateErrors.push({
          entityId: result.entityId,
          delegateId,
          request,
          purpose,
          code: error.code,
          reason: error.reason,
          shouldRetry: error.shouldRetry,
        })
      }
    }
    const successfulRequests = Object.entries(orderedRequestsInfoByEntityId)
      .flatMap(([entityId, requestsInfo]) => requestsInfo.map(({ delegateId, purpose }) => ({ entityId, delegateId, purpose })))
      .filter(({ entityId, delegateId }) => !updateErrors.some((error) => error.entityId === entityId && error.delegateId === delegateId))
    return {
      successfulUpdates: successfulRequests,
      updateErrors,
      unmodifiedEntitiesIds,
    }
  }

  /**
   * Whether an existing, already-established access level (`undefined` if none) is enough to satisfy a requested
   * permission, without needing to create/update a delegation just for the permission itself. `ROOT` is a special,
   * self-only request independent of any other delegation on the entity, so it is never considered satisfied by
   * unrelated existing coverage.
   *
   * `MAX_WRITE` doesn't demand write access outright: it resolves to WRITE only if the caller granting it
   * (`callerAccess`) itself has WRITE, and to READ otherwise - so an existing READ is already sufficient for a
   * `MAX_WRITE` request unless the caller could actually upgrade it to WRITE.
   */
  private isPermissionSufficient(
    existing: AccessLevel | undefined,
    requested: RequestedPermissionInternal,
    callerAccess: AccessLevel | undefined
  ): boolean {
    if (requested === 'ROOT') return false
    if (!existing) return false
    if (existing === 'WRITE') return true
    if (requested === 'FULL_READ') return true
    if (requested === 'FULL_WRITE') return false
    return callerAccess !== 'WRITE' // MAX_WRITE: existing READ is enough unless the caller could grant WRITE
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
        purpose: ShareRequestPurpose
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
        purpose: ShareRequestPurpose
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
        purpose: ShareRequestPurpose
      }[] = []
      const migrationRequests = await this.makeMigrationRequestsIfNeeded(entityWithType, dataForDelegates)
      for (const [delegate, request] of Object.entries(migrationRequests)) {
        currentRequests[String(currentOrderedRequests.length)] = request
        currentOrderedRequests.push({
          delegateId: delegate,
          request: dataForDelegates[delegate],
          // The migration request of a delegate the caller also asked to share with carries the requested content
          // too (see makeMigrationRequestForMemberOfHierarchy): it is both things at once, not just a migration.
          purpose: dataForDelegates[delegate] ? ShareRequestPurpose.RequestedShareAndMigration : ShareRequestPurpose.Migration,
        })
      }

      // Hoisted: needed both for the redundant-share check below and (as before) for potentialParentDelegations.
      const selfId = await this.dataOwnerApi.getCurrentDataOwnerId()
      const hierarchy = this.useParentKeys ? await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds() : [selfId]
      const existingDelegationMembersDetails = await this.securityMetadataDecryptor.getDelegationMemberDetails(entityWithType)

      // Whole-entity, content-independent permission a data owner already has via ANY existing delegation naming
      // them - matches how the backend itself authorizes writes ("is there at least one delegation with write
      // access"), so unlike content coverage below this is deliberately not restricted to what the current caller
      // can decrypt: permission-level metadata is not end-to-end encrypted the way secret ids/encryption keys are.
      const bestPermissionByDataOwner: { [id: string]: AccessLevel } = {}
      for (const members of Object.values(existingDelegationMembersDetails)) {
        for (const partyId of [members.delegator, members.delegate]) {
          if (partyId && bestPermissionByDataOwner[partyId] !== 'WRITE') {
            bestPermissionByDataOwner[partyId] = members.accessLevel
          }
        }
      }
      for (const dataOwnerId of Object.keys(entity.delegations ?? {})) {
        bestPermissionByDataOwner[dataOwnerId] = 'WRITE'
      }

      // Content a data owner already has DIRECT (decryptable-by-me) access to via any existing delegation naming
      // them as either party - only computed for content types actually requested by at least one delegate.
      const delegatesToProcess = Object.entries(dataForDelegates).filter(([delegate]) => !migrationRequests[delegate])
      const needsSecretIds = delegatesToProcess.some(([, r]) => (r.shareSecretIds ?? []).length > 0)
      const needsEncryptionKeys = delegatesToProcess.some(([, r]) => (r.shareEncryptionKeys ?? []).length > 0)
      const needsOwningEntityIds = delegatesToProcess.some(([, r]) => (r.shareOwningEntityIds ?? []).length > 0)
      const directSecretIds = needsSecretIds
        ? await this.securityMetadataDecryptor.directlyAccessibleValuesByDataOwner(entity, hierarchy, SecurityMetadataType.SecretId)
        : {}
      const directEncryptionKeys = needsEncryptionKeys
        ? await this.securityMetadataDecryptor.directlyAccessibleValuesByDataOwner(entity, hierarchy, SecurityMetadataType.EncryptionKey)
        : {}
      const directOwningEntityIds = needsOwningEntityIds
        ? await this.securityMetadataDecryptor.directlyAccessibleValuesByDataOwner(entity, hierarchy, SecurityMetadataType.OwningEntityId)
        : {}

      for (const [delegate, userRequest] of delegatesToProcess) {
        const filteredSecretIds = (userRequest.shareSecretIds ?? []).filter((id) => !directSecretIds[delegate]?.has(id))
        const filteredEncryptionKeys = (userRequest.shareEncryptionKeys ?? []).filter((k) => !directEncryptionKeys[delegate]?.has(k))
        const filteredOwningEntityIds = (userRequest.shareOwningEntityIds ?? []).filter((id) => !directOwningEntityIds[delegate]?.has(id))
        const nothingLeftToShare = !filteredSecretIds.length && !filteredEncryptionKeys.length && !filteredOwningEntityIds.length

        if (
          nothingLeftToShare &&
          this.isPermissionSufficient(bestPermissionByDataOwner[delegate], userRequest.requestedPermissions, bestPermissionByDataOwner[selfId])
        ) {
          continue // fully covered by some other already-decryptable, directly-named delegation: nothing to write
        }

        const request = await this.secureDelegationsManager.makeShareOrUpdateRequestParams(
          entityWithType,
          delegate,
          filteredSecretIds,
          filteredEncryptionKeys,
          filteredOwningEntityIds,
          userRequest.requestedPermissions
        )
        if (request) {
          currentRequests[String(currentOrderedRequests.length)] = request
          currentOrderedRequests.push({
            delegateId: delegate,
            request: userRequest,
            purpose: ShareRequestPurpose.RequestedShare,
          })
        }
      }
      if (Object.keys(currentRequests).length > 0) {
        const accessibleMembers = new Set(hierarchy)
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
      // `ShareResult` is part of the released public api and reports migration requests as a boolean: a request that
      // is both a requested share and a migration counts as one for it, as it always did.
      shareResult.updateErrors.map(({ purpose, ...errorDetails }) => ({
        ...errorDetails,
        updatedForMigration: purpose !== ShareRequestPurpose.RequestedShare,
      })),
      `There was an error sharing entity with id ${entity.entity.id}. Check the logs for more details.`
    )
  }

  async shareById(
    ids: string[],
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: SecretIdShareOptions
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKeys?: ShareMetadataBehaviour
        shareOwningEntityIds?: ShareMetadataBehaviour
      }
    },
    entitiesType: EntityWithDelegationTypeName,
    getStubs: (ids: string[]) => Promise<IcureStub[]>,
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<MinimalEntityBulkShareResult[]>
  ): Promise<ShareByIdResult> {
    const requestedIds = this.deduplicate(ids)
    const requestedDelegateIds = Object.keys(delegates)
    if (!requestedIds.length || !requestedDelegateIds.length) return new ShareByIdResult([], {}, {}, [])
    const stubs = this.deduplicateById((await getStubs(requestedIds)).filter((stub) => !!stub.id))
    const foundIds = stubs.map((stub) => stub.id!)
    const foundIdsSet = new Set(foundIds)
    const shareErrors: FailedRequestDetails[] = []
    const entitiesUpdates: { entity: IcureStub; dataForDelegates: ResolvedShareRequestsForDelegates }[] = []
    const requestSummariesByEntityId: { [entityId: string]: { [delegateId: string]: ShareRequestSummary } } = {}
    for (const stub of stubs) {
      const { dataForDelegates, requestSummaries, resolutionErrors } = await this.resolveShareByIdOptions(stub, entitiesType, delegates)
      shareErrors.push(...resolutionErrors)
      requestSummariesByEntityId[stub.id!] = requestSummaries
      if (Object.keys(dataForDelegates).length) entitiesUpdates.push({ entity: stub, dataForDelegates })
    }
    const bulkResult: { successfulUpdates: BulkShareSuccessfulUpdate[]; updateErrors: BulkShareUpdateError[] } = entitiesUpdates.length
      ? await this.doBulkShareOrUpdateNoEntitiesWithRetry(entitiesType, entitiesUpdates, getStubs, doRequestBulkShareOrUpdate, true)
      : { successfulUpdates: [], updateErrors: [] }
    // Note that both the successful and the failed requests may concern delegates that were not requested by the
    // user: those are the internal requests used to migrate the legacy delegations of the current data owner
    // hierarchy, and are reported flagged as such. There is no request summary for them since they were not asking
    // for anything on behalf of the user.
    shareErrors.push(
      ...bulkResult.updateErrors.map(
        (error) =>
          new FailedRequestDetails.RequestRejected(
            error.entityId,
            error.delegateId,
            error.reason ?? 'The request was rejected by the cloud without providing a reason',
            error.code,
            error.shouldRetry,
            error.purpose,
            requestSummariesByEntityId[error.entityId]?.[error.delegateId]
          )
      )
    )
    // Keeps track of the (entity, delegate) pairs for which something actually happened, so that the pairs that are
    // left are exactly those for which no request had to be sent at all.
    const accountedDelegateIdsByEntityId: { [entityId: string]: Set<string> } = {}
    const accountForPair = (entityId: string, delegateId: string) => {
      const accountedForEntity = accountedDelegateIdsByEntityId[entityId]
      if (accountedForEntity) {
        accountedForEntity.add(delegateId)
      } else {
        accountedDelegateIdsByEntityId[entityId] = new Set([delegateId])
      }
    }
    const successfulRequestsByEntityId: { [entityId: string]: SuccessfulRequestDetails[] } = {}
    for (const { entityId, delegateId, purpose } of bulkResult.successfulUpdates) {
      const details = new SuccessfulRequestDetails(delegateId, purpose)
      const successfulForEntity = successfulRequestsByEntityId[entityId]
      if (successfulForEntity) {
        successfulForEntity.push(details)
      } else {
        successfulRequestsByEntityId[entityId] = [details]
      }
      accountForPair(entityId, delegateId)
    }
    for (const error of shareErrors) {
      accountForPair(error.entityId, error.delegateId)
    }
    const unmodifiedDelegateIdsByEntityId: { [entityId: string]: string[] } = {}
    for (const entityId of foundIds) {
      const unmodifiedDelegateIds = requestedDelegateIds.filter((delegateId) => !accountedDelegateIdsByEntityId[entityId]?.has(delegateId))
      if (unmodifiedDelegateIds.length) unmodifiedDelegateIdsByEntityId[entityId] = unmodifiedDelegateIds
    }
    return new ShareByIdResult(
      requestedIds.filter((id) => !foundIdsSet.has(id)),
      successfulRequestsByEntityId,
      unmodifiedDelegateIdsByEntityId,
      shareErrors
    )
  }

  /**
   * Resolves the share options provided to {@link shareById} into the actual metadata to share for a single entity.
   * Delegates for which the options can't be satisfied are not included in the returned requests, but are instead
   * reported as resolution errors.
   */
  private async resolveShareByIdOptions(
    entity: IcureStub,
    entitiesType: EntityWithDelegationTypeName,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: SecretIdShareOptions
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKeys?: ShareMetadataBehaviour
        shareOwningEntityIds?: ShareMetadataBehaviour
      }
    }
  ): Promise<{
    dataForDelegates: ResolvedShareRequestsForDelegates
    requestSummaries: { [delegateId: string]: ShareRequestSummary }
    resolutionErrors: FailedRequestDetails[]
  }> {
    const entityWithType = { entity, type: entitiesType }
    const delegatesOptions = Object.entries(delegates)
    // Each of the following requires the decryption of the metadata of the entity, so we do it only if at least one
    // delegate actually needs that kind of metadata. AllAvailable (the default) needs the accessible secret ids to
    // share them, and UseExactly needs them to validate the provided ones, unless it may create unknown ones.
    const availableSecretIds = delegatesOptions.some(
      ([, options]) => !options.shareSecretIds || options.shareSecretIds.type === 'AllAvailable' || !options.shareSecretIds.createUnknownSecretIds
    )
      ? await this.secretIdsOf(entityWithType, undefined)
      : []
    const availableEncryptionKeys = delegatesOptions.some(([, options]) => options.shareEncryptionKeys !== ShareMetadataBehaviour.NEVER)
      ? await this.encryptionKeysOf(entityWithType, undefined)
      : []
    const availableOwningEntityIds = delegatesOptions.some(([, options]) => options.shareOwningEntityIds !== ShareMetadataBehaviour.NEVER)
      ? await this.owningEntityIdsOf(entityWithType, undefined)
      : []
    const dataForDelegates: ResolvedShareRequestsForDelegates = {}
    const requestSummaries: { [delegateId: string]: ShareRequestSummary } = {}
    const resolutionErrors: FailedRequestDetails[] = []
    for (const [delegateId, options] of delegatesOptions) {
      const resolvedSecretIds = this.resolveSecretIdShareOptions(options.shareSecretIds, availableSecretIds, `${entitiesType} ${entity.id}`)
      if (options.shareEncryptionKeys === ShareMetadataBehaviour.REQUIRED && !availableEncryptionKeys.length) {
        resolutionErrors.push(
          new FailedRequestDetails.ResolutionFailed(
            entity.id!,
            delegateId,
            `${entitiesType} ${entity.id} has no encryption keys or the current data owner can't access any encryption key, but sharing is required.`
          )
        )
      } else if (options.shareOwningEntityIds === ShareMetadataBehaviour.REQUIRED && !availableOwningEntityIds.length) {
        resolutionErrors.push(
          new FailedRequestDetails.ResolutionFailed(
            entity.id!,
            delegateId,
            `${entitiesType} ${entity.id} has no owning entity ids or the current data owner can't access any owning entity id, but sharing is required.`
          )
        )
      } else if ('failureReason' in resolvedSecretIds) {
        resolutionErrors.push(new FailedRequestDetails.ResolutionFailed(entity.id!, delegateId, resolvedSecretIds.failureReason))
      } else {
        const resolvedRequest = {
          shareSecretIds: resolvedSecretIds.secretIds,
          shareEncryptionKeys: options.shareEncryptionKeys === ShareMetadataBehaviour.NEVER ? [] : availableEncryptionKeys,
          shareOwningEntityIds: options.shareOwningEntityIds === ShareMetadataBehaviour.NEVER ? [] : availableOwningEntityIds,
          requestedPermissions: options.requestedPermissions ?? RequestedPermissionEnum.MAX_WRITE,
        }
        dataForDelegates[delegateId] = resolvedRequest
        requestSummaries[delegateId] = {
          requestedPermissions: resolvedRequest.requestedPermissions,
          secretIds: {
            source: options.shareSecretIds?.type === 'UseExactly' ? SharedSecretIdsSource.ExplicitValues : SharedSecretIdsSource.AllAvailable,
            count: resolvedRequest.shareSecretIds.length,
          },
          encryptionKeys: {
            behaviour: options.shareEncryptionKeys ?? ShareMetadataBehaviour.IF_AVAILABLE,
            count: resolvedRequest.shareEncryptionKeys.length,
          },
          owningEntityIds: {
            behaviour: options.shareOwningEntityIds ?? ShareMetadataBehaviour.IF_AVAILABLE,
            count: resolvedRequest.shareOwningEntityIds.length,
          },
        }
      }
    }
    return { dataForDelegates, requestSummaries, resolutionErrors }
  }

  /**
   * Resolves the {@link SecretIdShareOptions} of a delegate into the secret ids that will actually be shared for an
   * entity, given the secret ids of that entity that the current data owner can access. Returns instead the reason
   * why the options can't be satisfied for that entity, if they can't.
   */
  private resolveSecretIdShareOptions(
    options: SecretIdShareOptions | undefined,
    availableSecretIds: string[],
    entityDescription: string
  ): { secretIds: string[] } | { failureReason: string } {
    if (!options || options.type === 'AllAvailable') {
      if (options?.requireAtLeastOne && !availableSecretIds.length) {
        return { failureReason: `The current data owner can't access any secret id of ${entityDescription}, but at least one is required.` }
      }
      return { secretIds: availableSecretIds }
    }
    // The unknown ids themselves are not reported: they are secrets, and this reason usually ends up in a log.
    const unknownSecretIdsCount = options.createUnknownSecretIds ? 0 : options.secretIds.filter((id) => !availableSecretIds.includes(id)).length
    if (unknownSecretIdsCount) {
      return {
        failureReason:
          `${unknownSecretIdsCount} of the ${options.secretIds.length} requested secret ids are not secret ids of ${entityDescription} that ` +
          `the current data owner can access, and createUnknownSecretIds is false.`,
      }
    }
    return { secretIds: this.deduplicate(options.secretIds) }
  }

  /**
   * {@link bulkShareOrUpdateEncryptedEntityMetadataNoEntities} with a single automatic retry, using a freshly
   * retrieved version of the entities, of the requests that failed with a retriable error.
   * Only entities for which every request failed with a retriable error are retried: if some request succeeded for an
   * entity the successful requests would have to be applied again on the new revision of the entity, and there is no
   * guarantee that the entity is left in a better state than if we simply gave up.
   */
  private async doBulkShareOrUpdateNoEntitiesWithRetry(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: { entity: IcureStub; dataForDelegates: ResolvedShareRequestsForDelegates }[],
    getStubs: (ids: string[]) => Promise<IcureStub[]>,
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<MinimalEntityBulkShareResult[]>,
    retryFailedRequests: boolean
  ): Promise<{ successfulUpdates: BulkShareSuccessfulUpdate[]; updateErrors: BulkShareUpdateError[] }> {
    const result = await this.bulkShareOrUpdateEncryptedEntityMetadataNoEntities(entitiesType, entitiesUpdates, doRequestBulkShareOrUpdate)
    if (!retryFailedRequests || !result.updateErrors.length) return result
    const unmodifiedEntitiesIds = new Set(result.unmodifiedEntitiesIds)
    const entitiesIdsWithSuccessfulUpdates = new Set(result.successfulUpdates.map((x) => x.entityId))
    const errorsByEntityId = result.updateErrors.reduce((acc, error) => {
      ;(acc[error.entityId] = acc[error.entityId] ?? []).push(error)
      return acc
    }, {} as { [entityId: string]: BulkShareUpdateError[] })
    const idsToRetry = Object.entries(errorsByEntityId)
      .filter(
        ([entityId, errors]) =>
          errors.every((error) => error.shouldRetry) && !unmodifiedEntitiesIds.has(entityId) && !entitiesIdsWithSuccessfulUpdates.has(entityId)
      )
      .map(([entityId]) => entityId)
    if (!idsToRetry.length) return result
    const updatesToRetryByEntityId = Object.fromEntries(entitiesUpdates.map((update) => [update.entity.id!, update]))
    // Retrying makes sense only if the entity actually changed since we retrieved it: if it didn't the request would
    // be rejected again for the same reason.
    const updatesToRetry = (await getStubs(idsToRetry))
      .filter((stub) => !!stub.id && !!updatesToRetryByEntityId[stub.id] && stub.rev !== updatesToRetryByEntityId[stub.id].entity.rev)
      .map((stub) => ({ entity: stub, dataForDelegates: updatesToRetryByEntityId[stub.id!].dataForDelegates }))
    if (!updatesToRetry.length) return result
    const retriedEntitiesIds = new Set(updatesToRetry.map((update) => update.entity.id!))
    const retryResult = await this.doBulkShareOrUpdateNoEntitiesWithRetry(entitiesType, updatesToRetry, getStubs, doRequestBulkShareOrUpdate, false)
    return {
      successfulUpdates: [
        ...retryResult.successfulUpdates,
        ...result.successfulUpdates.filter((success) => !retriedEntitiesIds.has(success.entityId)),
      ],
      updateErrors: [...retryResult.updateErrors, ...result.updateErrors.filter((error) => !retriedEntitiesIds.has(error.entityId))],
    }
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
      SecurityMetadataType.EncryptionKey
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
    postProcessor?: (decryptedData: ArrayBuffer) => Promise<ArrayBuffer | undefined>
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    const triedKeys: Set<string> = new Set()
    const result = await this.doIncrementallyDecryptingKeys(entity.entity, entity.type, async (e, t, keys) => {
      for (const k of keys) {
        if (!triedKeys.has(k.raw)) {
          triedKeys.add(k.raw)
          try {
            const decrypted = await this.primitives.AES.decrypt(k.key, content)
            if (postProcessor) {
              const processed = await postProcessor(decrypted)
              if (processed !== undefined) return { success: processed }
            } else {
              return { success: decrypted }
            }
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
      return { data: ua2ab(content), wasDecrypted: false }
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
            (encryptedSelf) => this.tryDecryptJson(keys, encryptedSelf, false),
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
              () => Promise.resolve(null),
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
      usersWithAccessToNewKey,
      undefined
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
    let deduplicatedEntities = entities
    if (new Set(deduplicatedEntities.map((e) => e.id)).size != deduplicatedEntities.length) {
      console.error(`Duplicate entries in entities ${deduplicatedEntities.map((x) => x.id)}`)
      deduplicatedEntities = this.deduplicateById(deduplicatedEntities)
    }

    const hierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
    const allExtractedKeysForEntities = Object.fromEntries(deduplicatedEntities.map((x) => [x.id!, new Set<string>()] as [string, Set<string>]))
    const newlyExtractedKeysForEntities = Object.fromEntries(deduplicatedEntities.map((x) => [x.id!, new Set<string>()] as [string, Set<string>]))
    const results = new Map<string, T>()
    const remainingEntitiesById = Object.fromEntries(deduplicatedEntities.map((x) => [x.id!, x] as [string, E]))
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

  async initialiseConfidentialSecretId<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<EntityBulkShareResult<T>[]>
  ): Promise<T | undefined> {
    if (await this.getConfidentialSecretId({ entity, type: entityType })) return undefined
    const confidentialSecretId = this.primitives.randomUuid()
    return (
      await this.simpleShareOrUpdateEncryptedEntityMetadata(
        { entity, type: entityType },
        {
          [await this.dataOwnerApi.getCurrentDataOwnerId()]: {
            shareEncryptionKeys: ShareMetadataBehaviour.NEVER,
            shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
            shareSecretIds: [confidentialSecretId],
            requestedPermissions: RequestedPermissionEnum.MAX_WRITE,
          },
        },
        (request) => doRequestBulkShareOrUpdate(request)
      )
    ).updatedEntityOrThrow
  }

  async getConfidentialSecretId(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string | undefined> {
    return this.getConfidentialSecretIds(entity, dataOwnerId).then((x) => x[0])
  }

  async getConfidentialSecretIds(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]> {
    const chosenDataOwnerId = dataOwnerId ?? (await this.dataOwnerApi.getCurrentDataOwnerId())
    const dataOwnerHierarchy = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIdsFrom(chosenDataOwnerId)
    const hierarchySecretIds = (await this.secretIdsForHcpHierarchyOf(entity)).filter((x) => dataOwnerHierarchy.includes(x.ownerId))
    const keysForDataOwner = hierarchySecretIds.find((x) => x.ownerId === chosenDataOwnerId)

    if (!keysForDataOwner) return []
    return keysForDataOwner.extracted.filter((k) => !hierarchySecretIds.some((x) => x.ownerId !== chosenDataOwnerId && x.extracted.includes(k)))
  }

  async getAnySecretIdSharedWithParents(entity: EncryptedEntityWithType): Promise<string | undefined> {
    return (await this.getSecretIdsSharedWithParents(entity))[0]
  }

  async getSecretIdsSharedWithParents(entity: EncryptedEntityWithType): Promise<string[]> {
    return (await this.secretIdsForHcpHierarchyOf(entity))[0].extracted
  }

  async resolveSecretIdUseOptions(entity: EncryptedEntityWithType, option: SecretIdUseOption): Promise<string[]> {
    if (option == SecretIdUseOption.UseNone) {
      return []
    } else if (option == SecretIdUseOption.UseAnyConfidential) {
      const all = await this.getConfidentialSecretIds(entity, undefined)
      if (all.length == 0) throw new Error("Couldn't find any confidential secret id")
      return [all[0]]
    } else if (option == SecretIdUseOption.UseAllConfidential) {
      const all = await this.getConfidentialSecretIds(entity, undefined)
      if (all.length == 0) throw new Error("Couldn't find any confidential secret id")
      return all
    } else if (option == SecretIdUseOption.UseAnySharedWithParent) {
      const all = await this.getSecretIdsSharedWithParents(entity)
      if (all.length == 0) throw new Error("Couldn't find any secret id shared with parent")
      return [all[0]]
    } else if (option == SecretIdUseOption.UseAllSharedWithParent) {
      const all = await this.getSecretIdsSharedWithParents(entity)
      if (all.length == 0) throw new Error("Couldn't find any secret id shared with parent")
      return all
    } else if (option instanceof SecretIdUseOption.Use) {
      return [...new Set(option.secretIds)]
    } else {
      throw new Error(`Unrecognized SecretIdUseOption ${option}`)
    }
  }

  private deduplicateById<E extends { id?: string }>(entities: E[]): E[] {
    const seen = new Set<string | undefined>()
    return entities.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }
}
