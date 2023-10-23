import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { EncryptedEntityWithType } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

/**
 * @internal this class is for internal use only and may be changed without notice.
 * Logic for the decryption of the metadata used for access control, encryption, and other security features in an entity.
 */
export interface SecurityMetadataDecryptor {
  /**
   * Decrypt the encryption keys for an entity. Keys must be returned in raw hex format, removing dashes if they were generated from a UUID.
   * @param typedEntity an encrypted entity or its stub.
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when decrypting. It should
   * contain only data owners from the current data owner hierarchy.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted exchange key which yields objects containing:
   * - `decrypted`: a decrypted encryption key for {@link typedEntity}. Note that the same key may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   key was extracted. The generator may yield more elements with the same `decrypted` but different `dataOwnersWithAccess`
   */
  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never>

  /**
   * Decrypt the secret ids for an entity.
   * @param typedEntity an encrypted entity or its stub.
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when decrypting. It should
   * contain only data owners from the current data owner hierarchy.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted secret ids which yields objects containing:
   * - `decrypted`: a decrypted secret id of {@link entity}. Note that the same id may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   id was extracted. The generator may yield more elements with the same `decrypted` but different `dataOwnersWithAccess`
   */
  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never>

  /**
   * Decrypt the owning entity ids of an entity.
   * @param typedEntity an encrypted entity or its stub.
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when decrypting. It should
   * contain only data owners from the current data owner hierarchy.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted owning entity ids which yields objects containing:
   * - `decrypted`: a decrypted owning entity id of {@link entity}. Note that the same id may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   id was extracted. The generator may yield more elements with the same `decrypted` but different `dataOwnersWithAccess`
   */
  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never>

  /**
   * Get the maximum access level that any data owner in {@link dataOwnersHierarchySubset} has to {@link typedEntity}, according to the metadata
   * supported by this decryptor.
   * - If at least a data owner in {@link dataOwnersHierarchySubset} has write access the method returns {@link AccessLevel.WRITE}.
   * - If at least a data owner in {@link dataOwnersHierarchySubset} has read access and no data owner has write access the method returns
   * {@link AccessLevel.READ}.
   * - If a data owner has no access to the entity the method returns undefined (this can happen if the data owner has access to an entity through
   * some metadata which is not supported by this decryptor).
   * @param typedEntity an entity
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when calculating the
   * access level. This array should contain only data owners from the current data owner hierarchy.
   * @return the access level to the entity or undefined if none of the data owners has full access to the entity.
   */
  getEntityAccessLevel(typedEntity: EncryptedEntityWithType, dataOwnersHierarchySubset: string[]): Promise<AccessLevelEnum | undefined>

  /**
   * Verifies if there is at least one (encrypted) encryption key in the metadata supported by this decryptor, even if it can't be decrypted by the
   * current data owner.
   */
  hasAnyEncryptionKeys(entity: EncryptedEntity | EncryptedEntityStub): boolean
}

/**
 * @internal this class is meant for internal use only and may be changed without notice.
 * Security metadata decryptor which combines other existing decryptors.
 */
export class SecurityMetadataDecryptorChain implements SecurityMetadataDecryptor {
  constructor(private readonly decryptors: SecurityMetadataDecryptor[]) {}

  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptEncryptionKeysOf(typedEntity, dataOwnersHierarchySubset))
  }

  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptOwningEntityIdsOf(typedEntity, dataOwnersHierarchySubset))
  }

  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): AsyncGenerator<{ decrypted: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptSecretIdsOf(typedEntity, dataOwnersHierarchySubset))
  }

  async getEntityAccessLevel(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): Promise<SecureDelegation.AccessLevelEnum | undefined> {
    let currMaxLevel: SecureDelegation.AccessLevelEnum | undefined = undefined
    for (const d of this.decryptors) {
      const currLevel = await d.getEntityAccessLevel(typedEntity, dataOwnersHierarchySubset)
      if (currLevel === AccessLevelEnum.WRITE) {
        return currLevel
      }
      if (currLevel === AccessLevelEnum.READ) {
        currMaxLevel = AccessLevelEnum.READ
      }
    }
    return currMaxLevel
  }

  hasAnyEncryptionKeys(entity: EncryptedEntity | EncryptedEntityStub): boolean {
    return this.decryptors.some((d) => d.hasAnyEncryptionKeys(entity))
  }

  private concatenate<T>(getGenerator: (d: SecurityMetadataDecryptor) => AsyncGenerator<T, void, never>): AsyncGenerator<T, void, never> {
    async function* generator(decryptors: SecurityMetadataDecryptor[]): AsyncGenerator<T, void, never> {
      for (const d of decryptors) {
        const currGenerator = getGenerator(d)
        let next = await currGenerator.next()
        while (!next.done) {
          yield next.value
          next = await currGenerator.next()
        }
      }
    }
    return generator(this.decryptors)
  }
}
