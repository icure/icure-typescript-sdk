export class EntityShareRequest {
  constructor(params: {
    explicitDelegator?: string
    explicitDelegate?: string
    accessControlKeys: string[]
    secretIds?: string[]
    encryptionKeys?: string[]
    owningEntityIds?: string[]
    exchangeDataId?: string
    encryptedExchangeDataId?: { [fp: string]: string }
    requestedPermissions?: EntityShareRequest.RequestedPermissionInternal
  }) {
    if (!params.accessControlKeys.length) throw new Error('Access control keys should not be empty')
    this.explicitDelegator = params.explicitDelegator
    this.explicitDelegate = params.explicitDelegate
    this.accessControlKeys = params.accessControlKeys
    this.secretIds = params.secretIds
    this.encryptionKeys = params.encryptionKeys
    this.owningEntityIds = params.owningEntityIds
    this.exchangeDataId = params.exchangeDataId
    this.encryptedExchangeDataId = params.encryptedExchangeDataId
    this.requestedPermissions = params.requestedPermissions ?? EntityShareRequest.RequestedPermissionInternal.MAX_WRITE
  }

  /**
   * Id of the data owner which is sharing the entity (delegator), if it should be explicitly indicated or null if the
   * delegator requires anonymous delegations. If not null this must match the logged data owner id.
   */
  explicitDelegator?: string
  /**
   * Id of the data owner which will gain access to the entity (delegate), if it should be explicitly indicated or
   * null if the delegate requires anonymous delegations.
   */
  explicitDelegate?: string
  /**
   * The access control secrets of the exchange data used for the encryption of the ids and keys
   * to share. These are also used to uniquely identify an instance of share metadata.
   */
  accessControlKeys: string[]
  /**
   * Encrypted secret ids to share with the delegate.
   */
  secretIds?: string[]
  /**
   * Encrypted encryption keys to share with the delegate.
   */
  encryptionKeys?: string[]
  /**
   * Encrypted owning entity ids to share with the delegate.
   */
  owningEntityIds?: string[]
  /**
   * Id of the exchange data used for the encryption of the ids and keys to share. Must be null at least one of
   * delegator or delegate is not explicit.
   */
  exchangeDataId?: string
  /**
   * Must be non-empty if exactly one of delegator or delegate is explicit and the other is not, empty in all other
   * cases.
   */
  encryptedExchangeDataId?: { [fp: string]: string }
  /**
   * Permissions requested for the delegate.
   */
  requestedPermissions: EntityShareRequest.RequestedPermissionInternal
}

export namespace EntityShareRequest {
  /**
   * Strategy to use for the calculation of permissions for the new [SecureDelegation.permissions]
   */
  export type RequestedPermissionEnum = 'FULL_READ' | 'MAX_WRITE' | 'FULL_WRITE'
  export const RequestedPermissionEnum = {
    /**
     * The new secure delegation will give full-read access to the delegate. If in future iCure is going to support
     * fine-grained access control a user may have limited read access to an entity, and in such case the request
     * would fail (similarly to [FULL_WRITE]).
     */
    FULL_READ: 'FULL_READ' as RequestedPermissionEnum,

    /**
     * The new secure delegation will give maximum access to the delegate, depending on the rights of the delegator.
     * If the delegator has full-write access the delegate will also have full-write access else the delegate will
     * have full-read access.
     */
    MAX_WRITE: 'MAX_WRITE' as RequestedPermissionEnum,

    /**
     * The new secure delegation will give full-write access to the delegate. If the delegator does not have
     * full-write access to the entity the request will fail.
     */
    FULL_WRITE: 'FULL_WRITE' as RequestedPermissionEnum,
  }

  /**
   * @internal this type is for internal use only and may be changed without notice.
   * Additional values for requested permissions which are used automatically by the extended apis and should not
   * be used directly by the user.
   */
  export type RequestedPermissionInternal = 'ROOT' | RequestedPermissionEnum
  export const RequestedPermissionInternal = {
    /**
     * Request to create a root delegation on the entity. Usually new entities are created with a root delegation
     * for the creator data owner and no other data owners will be able to obtain root permissions, but there are
     * some situations where other data owners can create root delegations on existing entities:
     * - If a data owner has a legacy delegation on an entity he can create a root delegation. This is necessary in
     * cases where the data owner wants to share an entity with another data owner using the new delegation format
     * but does not have a delegation in the new format yet (the data owner creates a new root delegation self->self
     * and then creates a delegation self->other).
     * - A patient data owner is always allowed to create a root delegation for himself
     *
     * A root delegation gives full write permissions to the data owners which can access it (usually a root
     * delegation should be accessible only for one data owner, it should be a delegation a->a) and does not depend
     * on any other delegation: this means that no data owners except for the data owners with the root permission
     * can revoke it.
     */
    ROOT: 'ROOT' as RequestedPermissionInternal,
    FULL_READ: RequestedPermissionEnum.FULL_READ as RequestedPermissionInternal,
    MAX_WRITE: RequestedPermissionEnum.MAX_WRITE as RequestedPermissionInternal,
    FULL_WRITE: RequestedPermissionEnum.FULL_WRITE as RequestedPermissionInternal,
  }
}
