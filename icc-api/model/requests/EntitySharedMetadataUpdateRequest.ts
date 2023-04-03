/**
 * Parameters for the update of shared metadata. Currently only changes to secret ids, encryption keys and owning entity
 * ids are allowed. In the future we are going to allow also changes to the permissions of users with access to the
 * shared metadata.
 */
export class EntitySharedMetadataUpdateRequest {
  constructor(params: {
    metadataAccessControlHash: string
    secretIds?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
    encryptionKeys?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
    owningEntityIds?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
  }) {
    this.metadataAccessControlHash = params.metadataAccessControlHash
    this.secretIds = params.secretIds
    this.encryptionKeys = params.encryptionKeys
    this.owningEntityIds = params.owningEntityIds
  }

  /**
   * Access control hash of the metadata to update.
   */
  metadataAccessControlHash: string
  /**
   * Updates for secret ids: the key is an encrypted secret id and the value is if an entry with that encrypted secret
   * id should be created or deleted.
   */
  secretIds?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
  /**
   * Updates for encryption keys: a key in the map is an encrypted encrpytion key and the value is if an entry with
   * that encrypted encryption key should be created or deleted.
   */
  encryptionKeys?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
  /**
   * Updates for owning entity ids: the key is the encrypted id of an owning entity and the value is if an entry with
   * that encrypted owning entity id should be created or deleted.
   */
  owningEntityIds?: { [encryptedData: string]: EntitySharedMetadataUpdateRequest.EntryUpdateTypeEnum }
}
export namespace EntitySharedMetadataUpdateRequest {
  /**
   * Specifies if an entry should be created anew or deleted
   */
  export type EntryUpdateTypeEnum = 'CREATE' | 'DELETE'
  export const EntryUpdateTypeEnum = {
    CREATE: 'CREATE' as EntryUpdateTypeEnum,
    DELETE: 'DELETE' as EntryUpdateTypeEnum,
  }
}
