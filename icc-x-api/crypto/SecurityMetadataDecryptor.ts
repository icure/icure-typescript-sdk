import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'
import { EncryptedEntityWithType, EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'

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
   * @param tagsFilter only metadata with tags that pass the filter will be considered for decryption.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted exchange key which yields objects containing:
   * - `encryptionKey`: a decrypted encryption key for {@link typedEntity}. Note that the same key may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   key was extracted. The generator may yield more elements with the same `encryptionKey` but different `dataOwnersWithAccess`
   */
  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never>

  /**
   * Decrypt the secret ids for an entity.
   * @param typedEntity an encrypted entity or its stub.
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when decrypting. It should
   * contain only data owners from the current data owner hierarchy.
   * @param tagsFilter only metadata with tags that pass the filter will be considered for decryption.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted secret ids which yields objects containing:
   * - `secretId`: a decrypted secret id of {@link entity}. Note that the same id may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   id was extracted. The generator may yield more elements with the same `secretId` but different `dataOwnersWithAccess`
   */
  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never>

  /**
   * Decrypt the owning entity ids of an entity.
   * @param typedEntity an encrypted entity or its stub.
   * @param dataOwnersHierarchySubset only exchange data that is accessible to data owners in this array will be considered when decrypting. It should
   * contain only data owners from the current data owner hierarchy.
   * @param tagsFilter only metadata with tags that pass the filter will be considered for decryption.
   * @throws if dataOwnersHierarchySubset is empty
   * @return a generator for the decrypted owning entity ids which yields objects containing:
   * - `owningEntityId`: a decrypted owning entity id of {@link entity}. Note that the same id may be yielded multiple times by the generator.
   * - `dataOwnersWithAccess`: data owners which have access to the exchange data necessary for the decryption of the encrypted data from which this
   *   id was extracted. The generator may yield more elements with the same `owningEntityId` but different `dataOwnersWithAccess`
   */
  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never>
}

/**
 * @internal this class is meant for internal use only and may be changed without notice.
 * Security metadata decryptor which combines other existing decryptors.
 */
export class SecurityMetadataDecryptorChain implements SecurityMetadataDecryptor {
  constructor(private readonly decryptors: SecurityMetadataDecryptor[]) {}

  decryptEncryptionKeysOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ encryptionKey: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptEncryptionKeysOf(typedEntity, dataOwnersHierarchySubset, (t) => tagsFilter(t)))
  }

  decryptOwningEntityIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ owningEntityId: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptOwningEntityIdsOf(typedEntity, dataOwnersHierarchySubset, (t) => tagsFilter(t)))
  }

  decryptSecretIdsOf(
    typedEntity: EncryptedEntityWithType,
    dataOwnersHierarchySubset: string[],
    tagsFilter: (tags: string[]) => boolean
  ): AsyncGenerator<{ secretId: string; dataOwnersWithAccess: string[] }, void, never> {
    return this.concatenate((d) => d.decryptSecretIdsOf(typedEntity, dataOwnersHierarchySubset, (t) => tagsFilter(t)))
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
