/**
 * Represents the result of a share operation.
 */
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

export interface ShareResult<T> {
  /**
   * Return the updated entity if the share operation was successful, else throw an error.
   */
  get updatedEntityOrThrow(): T
}

/**
 * Represents the result of a successful share operation.
 */
export class ShareResultSuccess<T> {
  /**
   * @param updatedEntity The entity with updated encrypted metadata.
   */
  constructor(private readonly updatedEntity: T) {}

  get updatedEntityOrThrow(): T {
    return this.updatedEntity
  }
}

/**
 * Represents the result of a failed share operation.
 */
export class ShareResultFailure {
  /**
   * @param errorsDetails Details of the errors, as returned by the server.
   * @param message Human-friendly error message, should provide additional context that the server may not have had, for example if the original user
   * request was modified by the crypto API for migration purposes.
   */
  constructor(
    private readonly errorsDetails: {
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
    }[],
    private readonly message: string
  ) {}

  get updatedEntityOrThrow(): never {
    console.error(`Error when sharing an entity. Details: ${JSON.stringify(this.errorsDetails)}`)
    throw new Error(this.message)
  }
}
