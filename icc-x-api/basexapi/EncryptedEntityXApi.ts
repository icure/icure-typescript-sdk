import { EncryptedEntity, SecureDelegation } from '../../icc-api/model/models'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

/**
 * Interface of common methods for XApis of any encryptable entities.
 */
export interface EncryptedEntityXApi<T extends EncryptedEntity> {
  /**
   * Get the ids of all data owners with access to the provided entity, including their permissions on the entity. This method also uses the
   * information available to the current user to attempt to identify the anonymous data owners with access to this entity. Note however that
   * the user may not be capable of identifying all anonymous data owners with access to the entity. In cases where there is at least an anonymous
   * data owner with access to the entity the value of `hasUnknownAnonymousDataOwners` in the returned object will be `true` (`false` otherwise).
   * Note that users are only capable of identifying anonymous data owners in delegations where the user itself is involved, meaning that if a
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
   * @param entity an entity.
   * @return the available encryption keys for the entity, which could be decrypted by the current data owner. Normally this array should contain at
   * most one element but this method in case of entity merges there could be multiple values.
   */
  getEncryptionKeysOf(entity: T): Promise<string[]>
}
