export class SecureDelegation {
  constructor(json: JSON | any) {
    Object.assign(this as SecureDelegation, json)
  }

  /**
   * Optionally the id of the delegator data owner for this [SecureDelegation]. May be null if this information must
   * be hidden to prevent data leakages (see class documentation for more details).
   */
  delegator?: string
  /**
   * Optionally the id of the delegate data owner for this [SecureDelegation]. May be null if this information must
   * be hidden to prevent data leakages (see class documentation for more details).
   */
  delegate?: string
  /**
   * Secret id of the entity holding this [SecureDelegation] (formerly `delegation`). The id will appear in plaintext in the
   * `secretForeignKeys` field of children entities.
   */
  secretIds?: string[]
  /**
   * Encrypted aes key used for the encryption of the entity's data (data stored in `encryptedSelf`).
   */
  encryptionKeys?: string[]
  /**
   * Encrypted id of the entity which owns the entity holding this [SecureDelegation] (formerly `cryptedForeignKey`),
   * such as the id of the patient for a contact or healthcare element.
   */
  owningEntityIds?: string[]
  /**
   * Key of the parent delegation in the [SecurityMetadata.secureDelegations]. Users are allowed to modify/delete
   * only [SecureDelegation] that they can directly access or any children delegations.
   */
  parentDelegation!: string
  /**
   * If both the [delegator] and [delegate] are explicit in this secure delegation this field will hold the id of the exchange
   * data used for the encryption of this delegation. Otherwise, this will be null.
   */
  exchangeDataId?: string
  /**
   * If only the [delegator] or only the [delegate] is explicit in this secure delegation this field will hold the id of the
   * exchange data used for the encryption encrypted with the public keys of that data owner. Otherwise, this will be null.
   */
  encryptedExchangeDataId?: { [pubKeyFp: string]: string }
  /**
   * Permissions of users with access to this [SecureDelegation] on the corresponding entity. Each entry represents
   * a field or group of fields of the entity that the user can read and/or modify; any field not covered by this map
   * will not be accessible to the users. Note that the same user may have access to multiple instances of [SecureDelegation]
   * for the same entity with different permission levels.
   *
   * The permissions only refer to the actual content of the entity and not to any metadata (excluding the `encryptedSelf`):
   * - any data owner is always allowed to extend his [SecureDelegation] or its children (according to the hierarchy specified
   * by the [parentDelegation]).
   * - any data owner can create new [SecureDelegation] to share an entity he can access with other data owners, but he can
   * only give equivalent or lower permissions.
   *
   * Top level delegations must not specify any permissions, as any top-level delegation implicitly has full-write-permissions.
   * All other delegations instead must specify at least a permission.
   *
   * The full syntax of permissions is to be defined, currently only "*" is allowed as a key, meaning all entries: essentially
   * currently it is only possible to give full-read-permissions or full-write-permissions. This should allow for a smoother
   * transition when fine-grained permissions will be implemented.
   */
  permissions?: { [fieldPattern: string]: SecureDelegation.AccessLevel }
  /**
   * Tags for delegations, allows user to implement custom delegation logic.
   */
  tags?: string[]
}
export namespace SecureDelegation {
  export type AccessLevel = 'READ' | 'WRITE'
  export const AccessLevel = {
    READ: 'READ' as AccessLevel,
    WRITE: 'WRITE' as AccessLevel,
  }
}
