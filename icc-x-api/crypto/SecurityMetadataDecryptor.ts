import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevelEnum

/**
 * @internal this class is for internal use only and may be changed without notice.
 * Logic for the decryption of the metadata used for access control, encryption, and other security features in an entity.
 */
export interface SecurityMetadataDecryptor {
  /**
   * Decrypt the encryption keys for an entity.
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
   * Get the maximum access level that any data owner in {@link dataOwnersHierarchySubset} has to the entirety of {@link typedEntity}:
   * - If at least a data owner in {@link dataOwnersHierarchySubset} has full write access then the returned access level is write
   * - If at least a data owner in {@link dataOwnersHierarchySubset} has full read access then the returned access level, and no data owner has full
   * write access the method the returned access level is read
   * - If no data owner in {@link dataOwnersHierarchySubset} has full read or write access then the method returns undefined.
   * There is currently no support for field level permissions, but when that will be introduced this method will behave in the following way: if none
   * of the data owners in {@link dataOwnersHierarchySubset} has write access to a specific field of the entity the method returns at most read access
   * level, even if all other fields are accessible with write permissions. Similarly, if none of the data owners has at least read access to a
   * specific field of the entity the method will return undefined.
   * @param typedEntity an entity
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when calculating the
   * access level. This array should contain only data owners from the current data owner hierarchy.
   * @return the access level to the entity or undefined if none of the data owners has full access to the entity.
   */
  getFullEntityAccessLevel(typedEntity: EncryptedEntityWithType, dataOwnersHierarchySubset: string[]): Promise<AccessLevel | undefined>
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

  async getFullEntityAccessLevel(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[]
  ): Promise<SecureDelegation.AccessLevelEnum | undefined> {
    let currMaxLevel: SecureDelegation.AccessLevelEnum | undefined = undefined
    for (const d of this.decryptors) {
      const currLevel = await d.getFullEntityAccessLevel(typedEntity, dataOwnersHierarchySubset)
      if (currLevel === AccessLevel.WRITE) {
        return currLevel
      }
      if (currLevel === AccessLevel.READ) {
        currMaxLevel = AccessLevel.READ
      }
    }
    return currMaxLevel
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
