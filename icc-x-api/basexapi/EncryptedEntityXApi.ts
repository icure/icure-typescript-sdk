import { EncryptedEntity, SecureDelegation } from '../../icc-api/model/models'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

/**
 * Interface of common methods for XApis of any encryptable entities.
 */
export interface EncryptedEntityXApi<T extends EncryptedEntity> {
  /**
   * Get the ids of all data owners with access to the provided entity, including their permissions on the entity. This method also uses the
   * information available to the current user to attempt to identify the anonymous data owners with access to this entity.
   *
   * Note however that the user may not be capable of identifying all anonymous data owners with access to the entity. In cases where there is at least
   * an anonymous data owner with access to the entity that the current data owner can't identify the value of `hasUnknownAnonymousDataOwners` in the
   * returned object will be `true` (`false` otherwise).
   *
   * ## Basic anonymous data owners identification
   *
   * Initially users are only capable of identifying anonymous data owners in delegations where the user itself is involved, meaning that if a
   * specific anonymous data owners has access to an entity through two delegations, one accessible to the current user and one not, the anonymous
   * data owner will appear in the `permissionsByDataOwnerId`, but the `hasUnknownAnonymousDataOwners` will also be `true`, since the user can't know
   * if the other delegation refers to the same anonymous data owner or not.
   *
   * For example consider an entity with the following delegations, where `A` and `B` are unrelated explicit data owners, and `P` is an anonymous
   * data owner:
   * - A -> A - r/w
   * - A -> B - r/w
   * - A -> P - r
   * - B -> P - r/w
   * In this case we can get the following results, depending on whether the current user is `A`, `B` or `P`:
   * - `A` gets `{ permissionsByDataOwnerId: { A: 'WRITE', B: 'WRITE', P: 'READ' }, hasUnknownAnonymousDataOwners: true }` (`A` does not know that
   *   `B->P` actually refers to `P`, but only that it was created by `B`)
   * - `B` gets `{ permissionsByDataOwnerId: { A: 'WRITE', B: 'WRITE', P: 'WRITE' }, hasUnknownAnonymousDataOwners: true }` (`B` does not know that
   *   `A->P` actually refers to `P`, but only that it was created by `A`)
   * - `P` gets `{ permissionsByDataOwnerId: { A: 'WRITE', B: 'WRITE', P: 'WRITE' }, hasUnknownAnonymousDataOwners: false }` (`P` knows the
   *    delegations that he is part of)
   *
   * ## Anonymous data owner identification through de-anonymization metadata
   *
   * You also have the possibility of identifying anonymous data owners through the de-anonymization metadata. This metadata is created on request
   * by data owners that have access to the delegation anonymous data owners involved in the delegations, but can later be shared also by other
   * data owners.
   *
   * For example consider an entity with the following delegations, where `A`, `B` and `C` are unrelated explicit data owners, and `P` is an
   * anonymous data owner:
   * - A -> A
   * - A -> B
   * - A -> P
   *
   * As we know initially B will not be able to identify P (B only knows that [A,B] have access to the entity), but if A creates the
   * de-anonymization metadata for the delegation A->P, then B will be to do so.
   *
   * If later B shares the entity with C, resulting in the following delegations:
   * - A -> A
   * - A -> B
   * - A -> P
   * - B -> C
   *
   * C will initially be only aware of [A, B, C] having access to the entity, but now B can share with C the information that P has also
   * access to the entity through the delegation A->P. Note that if A had not created the de-anonymization metadata for the delegation A->P,
   * then B would not be able to share this information with C.
   *
   * @param entity an entity.
   * @return an object containing:
   * - `permissionsByDataOwnerId`: a map associating each data owner id with the access level to the entity. Currently only WRITE access is supported.
   * - `hasUnknownAnonymousDataOwners`: a boolean indicating if there are anonymous data owners with access to the entity that the current user can
   *   not identify.
   */
  getDataOwnersWithAccessTo(entity: T): Promise<{
    permissionsByDataOwnerId: { [dataOwnerId: string]: AccessLevelEnum }
    hasUnknownAnonymousDataOwners: boolean
  }>

  /**
   * Creates the metadata to support {@link delegates} in the de-anonymization of the delegations in the provided entity.
   *
   * Refer to {@link getDataOwnersWithAccessTo} for more information on how this metadata is used.
   *
   * # Important information
   *
   * while the metadata is created based on the delegations of the provided entity, the metadata may be used to de-anonymize
   * equivalent delegations in other entities of the same type.
   *
   * For example if A creates an entity of type T, shares it with B and P, and then creates the de-anonymization metadata
   * to allow B to de-anonymize the delegation A->P, then B will be able to de-anonymize any delegation A->P in any other
   * entity of type T that B can access (through the iCure cloud or directly through database replicas).
   *
   * @param entity an entity.
   * @param delegates users
   */
  createDelegationDeAnonymizationMetadata(entity: T, delegates: string[]): Promise<void>

  /**
   * @param entity an entity.
   * @return the available encryption keys for the entity, which could be decrypted by the current data owner. Normally this array should contain at
   * most one element but this method in case of entity merges there could be multiple values.
   */
  getEncryptionKeysOf(entity: T): Promise<string[]>
}
