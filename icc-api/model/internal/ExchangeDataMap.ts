/**
 * @internal this entity is meant for internal use only
 */
export class ExchangeDataMap {
  constructor(json: JSON | any) {
    Object.assign(this as ExchangeDataMap, json)
  }

  /**
   * the Id of the exchange data. It is the hex-encoded string of the hashed version of the access control key
   */
  id!: string
  /**
   * the revision of the exchange data in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * a map where each key is the fingerprint of a public key and the value is an exchange data id, encrypted with the private key corresponding to that public key.
   */
  encryptedExchangeDataIds!: { [keyPairFingerprint: string]: string }
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when the delete method is called.
   */
  deletionDate?: number
}
