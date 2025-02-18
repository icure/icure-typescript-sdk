import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { EntityShareOrMetadataUpdateRequest } from '../../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { EntityBulkShareResult } from '../../icc-api/model/requests/EntityBulkShareResult'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { ShareMetadataBehaviour } from './ShareMetadataBehaviour'
import { ShareResult } from '../utils/ShareResult'
import { MinimalEntityBulkShareResult } from '../../icc-api/model/requests/MinimalEntityBulkShareResult'
import { EncryptedFieldsManifest } from '../utils'
import { BulkShareOrUpdateMetadataParams } from '../../icc-api/model/requests/BulkShareOrUpdateMetadataParams'
import { SecretIdUseOption } from './SecretIdUseOption'

/**
 * @internal this interface is meant only for internal use and may be changed without notice.
 * Gives access to several functions to access encrypted entities metadata.
 */
export interface ExtendedApisUtils {
  // region metadata decryption
  /**
   * Get the encryption keys of an entity that the provided data owner can access, potentially using the keys for his parent.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the encryption keys that the provided data owner can decrypt, deduplicated.
   */
  encryptionKeysOf(entity: EncryptedEntityWithType, dataOwnerId: string | undefined): Promise<string[]>

  /**
   * Get the encryption keys of an entity that the current data owner and his parents can access. The resulting array contains the keys for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes keys accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same keys, but the keys extracted for each data owner are deduplicated.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @return the encryption keys that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  encryptionKeysForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]>

  /**
   * Get the secret ids (SFKs) of an entity that the provided data owner can access, potentially using the keys for his parent.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the secret ids (SFKs) that the provided data owner can decrypt, deduplicated.
   */
  secretIdsOf(entity: EncryptedEntityWithType, dataOwnerId: string | undefined): Promise<string[]>

  /**
   * Get the secret ids (SFKs) of an entity that the current data owner and his parents can access. The resulting array contains the ids for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same secret ids, but the secret ids extracted for each data owner are deduplicated.
   * @param entity an encrypted entity.
   * @return the secret ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  secretIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]>

  /**
   * Get the decrypted owning entity ids (formerly CFKs) for the provided entity that can be decrypted using the private keys of the current data
   * owner and his parents. The owning entity id would be, for example, the id of a patient for contact and healthcare elements, or the id of a
   * message for documents.
   * There should only be one owning entity id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate
   * data.
   * @param entity an encrypted entity.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the owning entity ids (CFKs) that the provided data owner can decrypt, deduplicated.
   */
  owningEntityIdsOf(entity: EncryptedEntityWithType, dataOwnerId: string | undefined): Promise<string[]>

  /**
   * Get the decrypted owning entity ids (formerly CFKs) for the provided entity that can be decrypted using the private keys of the current data
   * owner and his parents. The owning entity id would be, for example, the id of a patient for contact and healthcare elements, or the id of a
   * message for documents.
   * The resulting array contains the ids for each data owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids
   * accessible through the parent keys). The order of the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same owning entity ids, but the owning entity ids extracted for each data owner are
   * deduplicated in case they could be accessed through different delegations.
   * There should only be one owning entity id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate
   * data.
   * @param entity an encrypted entity.
   * @return the owning entity ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  owningEntityIdsForHcpHierarchyOf(entity: EncryptedEntityWithType): Promise<{ ownerId: string; extracted: string[] }[]>

  /**
   * Get if the current data owner has write access to the content of the entity.
   * @param entity an entity
   * @return if the current data owner (or one of his parents) has write access to the content of the entity.
   */
  hasWriteAccess(entity: EncryptedEntityWithType): Promise<boolean>

  /**
   * @param entity an entity
   * @return if the entity has no encryption metadata and can be safely initialised using .
   */
  hasEmptyEncryptionMetadata(entity: EncryptedEntity): boolean
  // endregion

  // region metadata initialisation and share
  resolveSecretIdUseOptions(entity: EncryptedEntityWithType, option: SecretIdUseOption): Promise<string[]>

  /**
   * Initializes encryption metadata for an entity. This includes the encrypted secret id, owning entity id, encryption key for the entity, and
   * the clear text secret foreign key of the parent entity.
   * This method returns a modified copy of the entity and DOES NOT SAVE the entity to the cloud/DB: you will have to save the entity manually.
   * @param entity entity which requires encryption metadata initialisation.
   * @param entityType type of the entity.
   * @param owningEntity id of the owning entity, if any (e.g. patient id for Contact/HealtchareElement, message id for Document, ...).
   * @param owningEntitySecretIds secret id of the parent entity, to use in the secret foreign keys for the provided entity, if any.
   * @param initialiseEncryptionKey if false this method will not initialize an encryption key for the entity. Use only for entities which use
   * delegations for access control but don't actually have any encrypted content.
   * HealthcareElement).
   * @param autoDelegations automatically shares the metadata with the provided data owners, with the provided access level.
   * @param alternateRootDelegation by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @throws if the entity already has non-empty values for encryption metadata.
   * @return an updated copy of the entity.
   */
  entityWithInitialisedEncryptedMetadata<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    owningEntity: string | undefined,
    owningEntitySecretIds: string[] | undefined,
    initialiseEncryptionKey: boolean,
    autoDelegations: { [p: string]: SecureDelegation.AccessLevelEnum },
    alternateRootDelegation: string | undefined
  ): Promise<{ updatedEntity: T; rawEncryptionKey: string | undefined; secretId: string | undefined }>

  /**
   * Updates encryption metadata for an entity in order to share it with a delegate or in order to add additional encrypted metadata for an existing
   * delegate.
   * The first time this method is used for a specific delegate it will give access to all unencrypted content of the entity to the delegate data
   * owner. Additionally, this method also allows to share new or existing secret ids (shareSecretId), encryption keys (shareEncryptionKeys) and
   * owning entity ids (shareOwningEntityIds) for the entity.
   * You can use methods like {@link secretIdsOf}, {@link secretIdsForHcpHierarchyOf}, {@link encryptionKeysOf}, ... to retrieve the data you want to
   * share. In most cases you may want to share everything related to the entity, but note that if you use confidential delegations for patients you
   * may want to avoid sharing the confidential secret ids of the current user with other hcps.
   * This updates the entity in the cloud/DB (the updated entities in the returned promise are already saved in the DB). NOTE: this method can only
   * be used with entities which already exist in the cloud (the entities must have been saved).
   * @param entitiesType type of entities to update
   * @param entitiesUpdates share/update requests for each entity. An array of objects containing:
   * - The entity to share/update (or at least its encrypted metadata)
   * - The data to share/update for each delegate. An object associating to each delegate id the data to share/update for that delegate, and the
   * permissions requested for the delegate (ignored if the request will only update already existing shared metadata).
   * @param doRequestBulkShareOrUpdate perform the request to share or update an entity encrypted metadata on the cloud API (and save to DB).
   * @throws if there are duplicate entities in the requested updates.
   * @return a promise which will be completed with an object containing:
   * - the updated entities, only for entities were at least one update was successful
   * - information on the individual requests failed, containing the id of the entity, id of the delegate that the request was for, the content,
   * an error code mirroring an http status code, and a human-friendly description of the error (but not necessarily end-user friendly).
   */
  bulkShareOrUpdateEncryptedEntityMetadata<T extends EncryptedEntityStub>(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: {
      entity: EncryptedEntityStub
      dataForDelegates: {
        [delegateId: string]: {
          shareSecretIds: string[]
          shareEncryptionKeys: string[]
          shareOwningEntityIds: string[]
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
  }>

  bulkShareOrUpdateEncryptedEntityMetadataNoEntities(
    entitiesType: EntityWithDelegationTypeName,
    entitiesUpdates: {
      entity: EncryptedEntityStub
      dataForDelegates: {
        [delegateId: string]: {
          shareSecretIds: string[]
          shareEncryptionKeys: string[]
          shareOwningEntityIds: string[]
          requestedPermissions: RequestedPermissionEnum
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
        requestedPermissions: RequestedPermissionEnum
      }
      updatedForMigration: boolean
      code?: number
      reason?: string
    }[]
  }>

  /**
   * Simplified version of {@link bulkShareOrUpdateEncryptedEntityMetadata} for a single entity and with automatic retrieval of the encryption keys
   * and owning entity ids if requested. NOTE: this method can only be used with entities which already exist in the cloud (the entity must have
   * been saved).
   * @param entity an entity.
   * versions. If true the method expects `shareSecretIds` options to always be undefined and will always share any available secret ids. If false
   * it expects `shareSecretIds` options to always be defined and will only share the secret ids specified in the options.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKeys specifies if the encryption keys of the entity should be shared. Defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * - shareOwningEntityIds specifies if the owning entity ids of the entity should be shared. Defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * - shareSecretIds specifies which secret ids of the entity should be shared. Should be defined only if {@link unusedSecretIds} is false.
   * - requestedPermissions requested permissions for the delegate. Defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @param doRequestBulkShareOrUpdate perform the request to share or update an entity encrypted metadata on the cloud API (and save to DB).
   * @return a promise which will be completed with the result of the operation
   * @throws if shareEncryptionKeys or shareOwningEntityIds is {@link ShareMetadataBehaviour.REQUIRED} and the current data owner can't access any
   * value for the required metadata.
   */
  simpleShareOrUpdateEncryptedEntityMetadata<T extends EncryptedEntityStub>(
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
  ): Promise<ShareResult<T>>
  // endregion

  // region content encryption and decryption
  /**
   * Encrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys of the entity there is no guarantee on which key will be used.
   * Note: you should not use this method to encrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to encrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param type type of the entity.
   * @param content data of the entity which you want to encrypt.
   * @param saveEntity a function which saves the entity to the cloud/DB. Used only if a new encryption key needed to be initialised for the entity.
   * @return the encrypted data and, if a new encryption key was initialised for the entity, the updated entity.
   * @throws if the provided data owner can't access any encryption keys for the entity.
   */
  encryptDataOf<T extends EncryptedEntityStub>(
    entity: T,
    type: EntityWithDelegationTypeName,
    content: ArrayBuffer | Uint8Array,
    saveEntity: (entity: T) => Promise<T>
  ): Promise<{ encryptedData: ArrayBuffer; updatedEntity: T | undefined }>

  /**
   * Decrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys each of them will be tried for decryption until one of them gives a result that is valid according to the
   * provided validator.
   * Note: you should not use this method to decrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to decrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param content data of the entity which you want to decrypt.
   * @param validator a function which verifies the correctness of decrypted content: helps to identify decryption with the wrong key without relying
   * solely on padding.
   * @return the decrypted data.
   * @throws if the provided data owner can't access any encryption keys for the entity, or if no key could be found which provided valid decrypted
   * content according to the validator.
   */
  tryDecryptDataOf(
    entity: EncryptedEntityWithType,
    content: ArrayBuffer | Uint8Array,
    validator: (decryptedData: ArrayBuffer) => Promise<boolean> | undefined
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }>

  tryDecryptEntities<T extends EncryptedEntity>(
    entities: T[],
    entityType: EntityWithDelegationTypeName,
    constructor: (json: any) => T
  ): Promise<{ entity: T; decrypted: boolean }[]>

  /**
   * Tries to decrypt data to a json object using the provided keys.
   */
  tryDecryptJson(potentialKeys: { key: CryptoKey; raw: string }[], encrypted: Uint8Array, truncateTrailingDecryptedNulls: boolean): Promise<{} | null>

  /**
   * Tries to encrypt the content of an encrypted entity.
   * 1. If valid key for encryption is found the method returns the entity with the encrypted fields specified by cryptedKeys
   * 2. If requireEncryption is true and no key could be found for encryption of the entity the method fails.
   * 3. If requireEncryption is false and no key could be found for encryption the method will only check that the entity does not specify any value
   * for fields which should be encrypted according to cryptedKeys (e.g. note in a patient using the default configuration). If the entity specifies
   * a value for any field which should be encrypted the method throws an error, otherwise the method returns the original entity.
   */
  tryEncryptEntities<T extends EncryptedEntity>(
    entities: T[],
    entityType: EntityWithDelegationTypeName,
    fieldsToEncrypt: EncryptedFieldsManifest,
    encodeBinaryData: boolean,
    requireEncryption: boolean,
    constructor: (json: any) => T
  ): Promise<T[]>

  /**
   * Verifies if the entity has valid encryption keys (regardless of whether the current data owner has access to them or not). If not this method
   * will throw an error, otherwise it will return undefined. For pre-2018 users there are some cases where the data may have been encrypted with a
   * key not safe for encryption anymore, in which case this method will return the entity with a new and safe encryption key.
   * After this method is called, if it returns an entity it should also be re-encrypted (using the new key) and saved to the cloud.
   */
  ensureEncryptionKeysInitialised<T extends EncryptedEntity>(entity: T, entityType: EntityWithDelegationTypeName): Promise<T | undefined>

  /**
   * Attempts to do the action providing "incrementally decrypted" keys as input; stops the first time the action
   * completes successfully.
   * The method tries to decrypt encryption keys for the entity "incrementally", trying first to decrypt keys that
   * require less effort for decryption (e.g. using already cached exchange data or using exchange data for which the
   * id is known without going through the exchange data map). Each time one or more new keys are decrypted the action
   * is called providing ALL keys decrypted up to that point.
   * If no key can be decrypted at all the method returns null without ever attempting the action (the action always
   * receives at least a key in input or is not called).
   * @param entity the entity from which to decrypt the encryption keys.
   * @param entityType the type of entity
   * @param action the action that consumes the encryption key.
   * @return the wrapped result of the first successful action invocation, or null if the action never succeeded or if
   * no key could be decrypted
   */
  doIncrementallyDecryptingKeys<E extends EncryptedEntity | EncryptedEntityStub, T>(
    entity: E,
    entityType: EntityWithDelegationTypeName,
    action: (entity: E, entityType: EntityWithDelegationTypeName, keys: { key: CryptoKey; raw: string }[]) => Promise<{ success: T } | null>
  ): Promise<{ success: T } | null>

  /**
   * Bulk version of {@link doIncrementallyDecryptingKeys}.
   * Differences:
   * - The action is called until it succeeds for all entities or until all decryptable keys have been tried.
   * - For each input the action must return an entry for that entity id with the result if successful or not include
   *   the entity id in the result keys if unsuccessful.
   * - An attempt on the action is done only if new keys could be decrypted for all the entities.
   *   Additionally, there will be a final attempt after attempting all decryption steps if at least a new key could be
   *   decrypted for an entity since the last attempt.
   *   In this case entities for which no new key could be decrypted are omitted from the input.
   * @param entities
   * @param entitiesType
   * @param action
   * @return all entities id for which the action completed successfully associated to the result.
   */
  doManyIncrementallyDecryptingKeys<E extends EncryptedEntity | EncryptedEntityStub, T>(
    entities: E[],
    entitiesType: EntityWithDelegationTypeName,
    action: (entity: E, entityType: EntityWithDelegationTypeName, keys: { key: CryptoKey; raw: string }[]) => Promise<{ success: T } | null>
  ): Promise<Map<string, T>>
  // endregion

  // region confidential ids

  /**
   * Ensures that the current data owner has access to a confidential secret id for the provided entity: this is an id that is known to the data owner
   * but is not known by any of his parents. If there is currently no confidential secret id for this entity the method returns a copy of the entity
   * with a new confidential secret id for the current data owner (the entity in the database won't be updated), else this method returns undefined.
   * New confidential secret ids will have an appropriate tag, but existing confidential secret ids may not necessarily have it.
   * @param entity an entity which needs to have a confidential secret id for the current data owner
   * @param entityType the type of the entity
   * @param doRequestBulkShareOrUpdate perform the request to share or update an entity encrypted metadata on the cloud API (and save to DB).
   * @return undefined if the entity already had a confidential secret id for the current user, or the updated AND SAVED entity with the new
   * confidential secret id.
   */
  initialiseConfidentialSecretId<T extends EncryptedEntity>(
    entity: T,
    entityType: EntityWithDelegationTypeName,
    doRequestBulkShareOrUpdate: (request: BulkShareOrUpdateMetadataParams) => Promise<EntityBulkShareResult<T>[]>
  ): Promise<T | undefined>

  /**
   * Get an existing confidential secret id of the provided entity for the provided data owner (current data owner by default). A confidential secret
   * id is a secret id known by the data owner but not known by any of his parents: note however that children will know confidential secret ids.
   * @param entity an entity for which you want to retrieve the confidential secret id.
   * @param dataOwnerId (current data owner by default) a data owner for which you want to get a confidential secret id.
   * @return the confidential secret id or undefined if there is no confidential secret id for the provided data owner.
   */
  getConfidentialSecretId(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string | undefined>

  /**
   * Get all existing confidential secret ids of the provided entity for the provided data owner (current data owner by default). A confidential secret
   * id is a secret id known by the data owner but not known by any of his parents: note however that children will know confidential secret ids.
   * @param entity an entity for which you want to retrieve the confidential secret id.
   * @param dataOwnerId (current data owner by default) a data owner for which you want to get a confidential secret id.
   * @return the confidential secret ids for the data owner (may be empty).
   */
  getConfidentialSecretIds(entity: EncryptedEntityWithType, dataOwnerId?: string): Promise<string[]>

  /**
   * Gets a secret id known by the topmost parent of the current data owner hierarchy. If there is multiple secret ids shared with the topmost parent
   * there is no guarantee on which one will be chosen.
   * @param entity an entity.
   * @return a secret id known by the topmost parent of the current data owner hierarchy, or undefined if there is no secret id currently available
   * for the topmost parent.
   */
  getAnySecretIdSharedWithParents(entity: EncryptedEntityWithType): Promise<string | undefined>

  /**
   * Gets all secret ids known by the topmost parent of the current data owner hierarchy (or all secret ids known by the current data owner if he is
   * not part of any data owner hierarchy).
   * @param entity an entity.
   * @return all secret ids known by the topmost parent of the current data owner hierarchy, may be empty.
   */
  getSecretIdsSharedWithParents(entity: EncryptedEntityWithType): Promise<string[]>
  // endregion
}
