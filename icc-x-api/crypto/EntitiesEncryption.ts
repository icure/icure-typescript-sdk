import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevel

/**
 * Gives access to several functions to access encrypted entities metadata.
 */
export interface EntitiesEncryption {
  /**
   * Get the encryption keys of an entity that the provided data owner can access, potentially using the keys for his parent.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the encryption keys that the provided data owner can decrypt, deduplicated.
   */
  encryptionKeysOf(entity: EncryptedEntity | EncryptedEntityStub, entityType?: EntityWithDelegationTypeName, dataOwnerId?: string): Promise<string[]>

  /**
   * Get the encryption keys of an entity that the current data owner and his parents can access. The resulting array contains the keys for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes keys accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same keys, but the keys extracted for each data owner are deduplicated.
   * There should only be one encryption key for each entity, but the method supports more to allow to deal with conflicts and merged duplicate data.
   * @param entity an encrypted entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @return the encryption keys that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  encryptionKeysForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    entityType?: EntityWithDelegationTypeName
  ): Promise<{ ownerId: string; extracted: string[] }[]>

  /**
   * Get the secret ids (SFKs) of an entity that the provided data owner can access, potentially using the keys for his parent.
   * @param entity an encrypted entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the secret ids (SFKs) that the provided data owner can decrypt, deduplicated.
   */
  secretIdsOf(entity: EncryptedEntity | EncryptedEntityStub, entityType?: EntityWithDelegationTypeName, dataOwnerId?: string): Promise<string[]>

  /**
   * Get the secret ids (SFKs) of an entity that the current data owner and his parents can access. The resulting array contains the ids for each data
   * owner in the hierarchy which can be decrypted using only that data owner keys (excludes ids accessible through the parent keys). The order of
   * the array is the same as in {@link IccDataOwnerXApi.getCurrentDataOwnerHierarchyIds}.
   * Note that different data owners may have access to the same secret ids, but the secret ids extracted for each data owner are deduplicated.
   * @param entity an encrypted entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @return the secret ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  secretIdsForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    entityType?: EntityWithDelegationTypeName
  ): Promise<{ ownerId: string; extracted: string[] }[]>

  /**
   * Get the decrypted owning entity ids (formerly CFKs) for the provided entity that can be decrypted using the private keys of the current data
   * owner and his parents. The owning entity id would be, for example, the id of a patient for contact and healthcare elements, or the id of a
   * message for documents.
   * There should only be one owning entity id for each entity, but the method supports more to allow to deal with conflicts and merged duplicate
   * data.
   * @param entity an encrypted entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the owning entity ids (CFKs) that the provided data owner can decrypt, deduplicated.
   */
  owningEntityIdsOf(entity: EncryptedEntity | EncryptedEntityStub, entityType?: EntityWithDelegationTypeName, dataOwnerId?: string): Promise<string[]>

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
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @return the owning entity ids that each member of the current data owner hierarchy can decrypt using only his keys and not keys of his parents.
   */
  owningEntityIdsForHcpHierarchyOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    entityType?: EntityWithDelegationTypeName
  ): Promise<{ ownerId: string; extracted: string[] }[]>

  // TODO share method

  /**
   * Encrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys of the entity there is no guarantee on which key will be used.
   * Note: you should not use this method to encrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to encrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @param content data of the entity which you want to encrypt.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @return the encrypted data.
   * @throws if the provided data owner can't access any encryption keys for the entity.
   */
  encryptDataOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    content: ArrayBuffer | Uint8Array,
    entityType?: EntityWithDelegationTypeName,
    dataOwnerId?: string
  ): Promise<ArrayBuffer>

  /**
   * Decrypts data using a key of the entity that the provided data owner can access (current data owner by default). If the provided data owner can
   * access multiple encryption keys each of them will be tried for decryption until one of them gives a result that is valid according to the
   * provided validator.
   * Note: you should not use this method to decrypt the `encryptedSelf` of iCure entities, since that will be automatically handled by the extended
   * apis. You should use this method only to decrypt additional data, such as document attachments.
   * @param entity an entity.
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @param content data of the entity which you want to decrypt.
   * @param dataOwnerId optionally a data owner part of the hierarchy for the current data owner, defaults to the current data owner.
   * @param validator a function which verifies the correctness of decrypted content: helps to identify decryption with the wrong key without relying
   * solely on padding.
   * @return the decrypted data.
   * @throws if the provided data owner can't access any encryption keys for the entity, or if no key could be found which provided valid decrypted
   * content according to the validator.
   */
  decryptDataOf(
    entity: EncryptedEntity | EncryptedEntityStub,
    content: ArrayBuffer | Uint8Array,
    entityType?: EntityWithDelegationTypeName,
    validator?: (decryptedData: ArrayBuffer) => Promise<boolean>,
    dataOwnerId?: string
  ): Promise<ArrayBuffer>

  /**
   * Get if the current data owner has access to the entirety of the provided entity in some way, and if yes specifies whether the access is read-only
   * or read-write. There is currently no support for field-level permissions so currently a user will only have either full write-only or full
   * read-only access on an entity, and never read access to some fields and write in others. In future whn field-level are introduced this method
   * will behave in the following way: if the data owner has read-only permissions in at least one field this method will return at most read access
   * level, even if all other fields are accessible with write permissions. Similarly, if the data owners has no read access to at least a field then
   * this method will return undefined (even though the data owner could still access some fields).
   * @param entity an entity
   * @param entityType the type of {@link entity}. This is necessary in cases where entity has not been instantiated using a constructor and in cases
   * where entity is just a stub.
   * @return if the current data owner (or one of his parents) has access to the entirety of the provided entity returns the AccessLevel (full
   * read-only or full read-write), else undefined.
   */
  getAccessLevelOfCurrentDataOwnerOnEntireEntity(
    entity: EncryptedEntity | EncryptedEntityStub,
    entityType?: EntityWithDelegationTypeName
  ): Promise<AccessLevel | undefined>
}
