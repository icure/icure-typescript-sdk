import { CryptoPrimitives } from './CryptoPrimitives'
import { EntityWithDelegationTypeName, entityWithDelegationTypeNames } from '../utils/EntityWithDelegationTypeName'
import { ua2hex, utf8_2ua } from '../utils'

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 */
export class AccessControlSecretUtils {
  constructor(private readonly primitives: CryptoPrimitives) {}

  /**
   * Get the access control key to use for entities of the provided type and confidentiality using the provided secret.
   * The access control key will
   * @param accessControlSecret an access control secret
   * @param entityTypeName an entity type name
   * @param confidential if the key is used for a confidential entity or not
   */
  async accessControlKeyFor(accessControlSecret: string, entityTypeName: EntityWithDelegationTypeName, confidential: boolean): Promise<ArrayBuffer> {
    return (await this.primitives.sha256(utf8_2ua(accessControlSecret + entityTypeName + confidential))).slice(0, 16)
  }

  /**
   * Get the hash to use as key in secure delegations for entities of the provided type and confidentiality using the provided secret.
   * @param accessControlSecret an access control secret
   * @param entityTypeName an entity type name
   * @param confidential if the key is used for a confidential entity or not
   */
  async accessControlHashFor(accessControlSecret: string, entityTypeName: EntityWithDelegationTypeName, confidential: boolean): Promise<string> {
    return ua2hex(await this.primitives.sha256(await this.accessControlKeyFor(accessControlSecret, entityTypeName, confidential)))
  }

  /**
   * Get all possible hashes which can be used as keys in secure delegations for a specific secret.
   * @param accessControlSecret an access control secret
   * @return all hashes which the access control secret can produce.
   */
  async allHashesForSecret(accessControlSecret: string): Promise<string[]> {
    return await Promise.all(
      Array.from(entityWithDelegationTypeNames).flatMap((et) => [
        this.accessControlHashFor(accessControlSecret, et, true),
        this.accessControlHashFor(accessControlSecret, et, false),
      ])
    )
  }
}
