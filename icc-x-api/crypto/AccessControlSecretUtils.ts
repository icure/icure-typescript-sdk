import { CryptoPrimitives } from './CryptoPrimitives'
import { EntityWithDelegationTypeName, entityWithDelegationTypeNames } from '../utils/EntityWithDelegationTypeName'
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
   */
  async accessControlKeyFor(accessControlSecret: string, entityTypeName: EntityWithDelegationTypeName): Promise<ArrayBuffer> {
    return (await this.primitives.sha256(utf8_2ua(accessControlSecret + entityTypeName))).slice(0, ACCESS_CONTROL_KEY_LENGTH_BYTES)
  }

  async allAccessControlKeyFor(accessControlSecret: string): Promise<ArrayBuffer[]> {
    const res: ArrayBuffer[] = []
    for (const entityTypeName of entityWithDelegationTypeNames) {
      res.push((await this.primitives.sha256(utf8_2ua(accessControlSecret + entityTypeName))).slice(0, ACCESS_CONTROL_KEY_LENGTH_BYTES))
    }
    return res
  }

  /**
   * Get value to use as key in secure delegations for entities of the provided type with the provided secret foreign key. The combination of secret
   * foreign keys and entity type ensures that unauthorised people will not be able to draw links between entities of different types of data or
   * different confidentiality levels.
   * These keys will be used in the secure delegations map of security metadata.
   * @param accessControlSecret an access control secret
   * @param entityTypeName an entity type name
   */
  async secureDelegationKeyFor(accessControlSecret: string, entityTypeName: EntityWithDelegationTypeName): Promise<string> {
    return ua2hex(await this.primitives.sha256(await this.accessControlKeyFor(accessControlSecret, entityTypeName)))
  }

  async allSecureDelegationKeysFor(accessControlSecret: string): Promise<string[]> {
    const accessControlKeys = await this.allAccessControlKeyFor(accessControlSecret)
    const res: string[] = []
    for (const accessControlKey of accessControlKeys) {
      res.push(ua2hex(await this.primitives.sha256(accessControlKey)))
    }
    return res
  }

  async getEncodedAccessControlKeys(accessControlSecrets: string[], entityTypeName: EntityWithDelegationTypeName): Promise<string> {
    const fullBuffer = new Uint8Array(accessControlSecrets.length * this.accessControlKeyLengthBytes)
    for (let i = 0; i < accessControlSecrets.length; i++) {
      const accessControlSecret = accessControlSecrets[i]
      const key = await this.accessControlKeyFor(accessControlSecret, entityTypeName)
      fullBuffer.set(new Uint8Array(key), i * this.accessControlKeyLengthBytes)
    }
    return ua2b64(fullBuffer)
  }
}
