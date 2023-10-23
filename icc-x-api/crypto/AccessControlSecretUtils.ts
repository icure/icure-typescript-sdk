import { CryptoPrimitives } from './CryptoPrimitives'
import { EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { ua2b64, ua2hex, utf8_2ua } from '../utils'

const ACCESS_CONTROL_KEY_LENGTH_BYTES = 16

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 */
export class AccessControlSecretUtils {
  constructor(private readonly primitives: CryptoPrimitives) {}

  /**
   * Size of the access control keys returned by this class.
   */
  get accessControlKeyLengthBytes(): number {
    return ACCESS_CONTROL_KEY_LENGTH_BYTES
  }

  /**
   * Get the access control key to use for entities of the provided type and using the provided secret foreign key. The combination of secret foreign
   * keys and entity type ensures that unauthorised people will not be able to draw links between entities of different types of data or different
   * confidentiality levels.
   * These keys will be sent to the icure server for access control of data owners which require anonymous delegations.
   * @param accessControlSecret an access control secret
   * @param entityTypeName an entity type name
   * @param secretForeignKey optionally a secret foreign key to include in the secret. "" and undefined are equivalent.
   */
  async accessControlKeyFor(
    accessControlSecret: string,
    entityTypeName: EntityWithDelegationTypeName,
    secretForeignKey: string | undefined
  ): Promise<ArrayBuffer> {
    // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
    // Ignore secret foreign key for now
    return (await this.primitives.sha256(utf8_2ua(accessControlSecret + entityTypeName /* + (secretForeignKey ?? '')*/))).slice(
      0,
      ACCESS_CONTROL_KEY_LENGTH_BYTES
    )
  }

  /**
   * Get the access control keys for proving access to an entity of provided type with the provided secret foreign keys.
   */
  async accessControlKeysFor(
    accessControlSecret: string,
    entityTypeName: EntityWithDelegationTypeName,
    secretForeignKeys: string[]
  ): Promise<ArrayBuffer[]> {
    return await this.getKeys(accessControlSecret, entityTypeName, secretForeignKeys, (a, b, c) => this.accessControlKeyFor(a, b, c))
  }

  /**
   * Get value to use as key in secure delegations for entities of the provided type with the provided secret foreign key. The combination of secret
   * foreign keys and entity type ensures that unauthorised people will not be able to draw links between entities of different types of data or
   * different confidentiality levels.
   * These keys will be used in the secure delegations map of security metadata.
   * @param accessControlSecret an access control secret
   * @param entityTypeName an entity type name
   * @param secretForeignKey optionally a secret foreign key to include in the secret. "" and undefined are equivalent.
   */
  async secureDelegationKeyFor(
    accessControlSecret: string,
    entityTypeName: EntityWithDelegationTypeName,
    secretForeignKey: string | undefined
  ): Promise<string> {
    return ua2hex(await this.primitives.sha256(await this.accessControlKeyFor(accessControlSecret, entityTypeName, secretForeignKey)))
  }

  /**
   * Get the secure delegations keys which can be used on an entity of provided type with the provided secret foreign keys.
   */
  async secureDelegationKeysFor(
    accessControlSecret: string,
    entityTypeName: EntityWithDelegationTypeName,
    secretForeignKeys: string[]
  ): Promise<string[]> {
    return await this.getKeys(accessControlSecret, entityTypeName, secretForeignKeys, (a, b, c) => this.secureDelegationKeyFor(a, b, c))
  }

  async getEncodedAccessControlKeys(accessControlSecrets: string[], entityTypeName: EntityWithDelegationTypeName): Promise<string> {
    const fullBuffer = new Uint8Array(accessControlSecrets.length * this.accessControlKeyLengthBytes)
    for (let i = 0; i < accessControlSecrets.length; i++) {
      const accessControlSecret = accessControlSecrets[i]
      const key = await this.accessControlKeyFor(accessControlSecret, entityTypeName, undefined)
      fullBuffer.set(new Uint8Array(key), i * this.accessControlKeyLengthBytes)
    }
    return ua2b64(fullBuffer)
  }

  private async getKeys<T>(
    accessControlSecret: string,
    entityTypeName: EntityWithDelegationTypeName,
    secretForeignKeys: string[],
    getKey: (accessControlSecret: string, entityTypeName: EntityWithDelegationTypeName, secretForeignKey: string | undefined) => Promise<T>
  ): Promise<T[]> {
    // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact

    // if (!secretForeignKeys.length) {
    return [await getKey(accessControlSecret, entityTypeName, undefined)]
    // } else {
    //   return await Promise.all(secretForeignKeys.map((sfk) => getKey(accessControlSecret, entityTypeName, sfk)))
    // }
  }
}
