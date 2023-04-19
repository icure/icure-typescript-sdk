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

  /**
   * Map the result of a successful share operation to another type.
   * @param f The mapping function.
   * @return If the share result was successful a new share result containing the result of the mapping function, else the original share result.
   */
  mapSuccess<U>(f: (t: T) => U): ShareResult<U>

  /**
   * Async version of {@link mapSuccess}.
   */
  mapSuccessAsync<U>(f: (t: T) => Promise<U>): Promise<ShareResult<U>>
}

/**
 * Represents the result of a successful share operation.
 */
export class ShareResultSuccess<T> implements ShareResult<T> {
  /**
   * @param updatedEntity The entity with updated encrypted metadata.
   */
  constructor(private readonly updatedEntity: T) {}

  get updatedEntityOrThrow(): T {
    return this.updatedEntity
  }

  mapSuccess<U>(f: (t: T) => U): ShareResult<U> {
    return new ShareResultSuccess(f(this.updatedEntity))
  }

  async mapSuccessAsync<U>(f: (t: T) => Promise<U>): Promise<ShareResult<U>> {
    return new ShareResultSuccess(await f(this.updatedEntity))
  }
}

/**
 * Represents the result of a failed share operation.
 */
export class ShareResultFailure implements ShareResult<never> {
  /**
   * @param errorsDetails Details of the errors, as returned by the server.
   * @param message Human-friendly error message, should provide additional context that the server may not have had, for example if the original user
   * request was modified by the crypto API for migration purposes.
   */
  constructor(
    readonly errorsDetails: {
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
    readonly message: string
  ) {}

  get updatedEntityOrThrow(): never {
    console.error(`Error when sharing an entity. Details: ${JSON.stringify(this.errorsDetails)}`)
    throw new Error(this.message)
  }

  mapSuccess<U>(f: (t: never) => U): ShareResult<U> {
    return this
  }

  mapSuccessAsync<U>(f: (t: never) => Promise<U>): Promise<ShareResult<U>> {
    return Promise.resolve(this)
  }
}
