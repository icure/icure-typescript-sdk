/**
 * @internal this entity is meant for internal use only
 */
export class ExchangeData {
  constructor(json: JSON | any) {
    if (
      !json.delegator ||
      !json.delegate ||
      !json.exchangeKey ||
      !json.accessControlSecret ||
      !json.sharedSignatureKey ||
      !json.sharedSignature ||
      !json.delegatorSignature
    )
      throw new Error(`Exchange data json is missing required properties.\n${JSON.stringify(json, undefined, 2)}`)
    Object.assign(this as ExchangeData, json)
  }

  /**
   * the Id of the exchange data. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * the revision of the exchange data in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * ID of the data owner which created this exchange data, in order to share some data with the [delegate].
   */
  delegator!: string
  /**
   * ID of a data owner which can use this exchange data to access data shared with him by [delegator].
   */
  delegate!: string
  /**
   * Aes key to use for sharing data from the delegator to the delegate, encrypted with the public keys of both delegate
   * and delegator. This key should never be sent decrypted to the server, as it allows to read medical data.
   */
  exchangeKey!: { [keyPairFingerprint: string]: string }
  /**
   * Key used for access control to data shared from the delegator to the delegate, encrypted with the public keys of both
   * delegate and delegator.
   *
   * This key will be used by the client to calculate the keys of [HasSecureDelegationsAccessControl.securityMetadata] which
   * allows to implement a form of access control where the identity of data owners with access to a specific entity can't be
   * deduced from the database alone. This is useful for example to allow patients to access their medical data without creating
   * a deducible link between the patient and the medical data in the database.
   *
   * There are no strict requirements on how the client should use this secret to create the security metadata key, but for
   * authentication the client must be able to provide a 128 bit long access control key (see [DataOwnerAuthenticationDetails.accessControlKeys])
   * which once hashed using sha256 will give the key of the security metadata.
   * However, in order to avoid introducing undesired links between entities which could be detrimental to the patients privacy
   * the access control keys should be created also using information on the entity class and confidentiality level of information
   * in applications where hcps share information using a hierarchical structure.
   * ```
   * accessControlKey = sha256Bytes(accessControlSecret + entityClass + confidentialityLevel).take(16)
   * securityMetadataKey = sha256Hex(accessControlKey)
   * ```
   */
  accessControlSecret!: { [keyPairFingerprint: string]: string }
  /**
   * Encrypted signature key (hmac-sha256) shared between delegate and delegator, to allow either of them to modify
   * the exchange data, without voiding the authenticity guarantee.
   */
  sharedSignatureKey!: { [keyPairFingerprint: string]: string }
  /**
   * Signature to ensure the key data has not been tampered with by third parties (any actor without access to the
   * keypair of the delegator/delegate): when creating new exchange data the delegator will create a new hmac key and
   * sign it with his own private key.
   * This field will contain the signature by fingerprint of the public key to use for verification.
   */
  delegatorSignature!: { [keyPairFingerprint: string]: string }
  /**
   * Base 64 signature of the exchange data, to ensure it was not tampered by third parties. This signature validates:
   * - The (decrypted) exchange key
   * - The (decrypted) access control secret
   * - The delegator and delegates being part of the exchange data
   * - The public keys used in the exchange data (allows to consider them as verified in a second moment).
   */
  sharedSignature!: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when the delete method is called.
   */
  deletionDate?: number
}
