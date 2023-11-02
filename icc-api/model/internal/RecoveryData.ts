/**
 * @internal this entity is meant for internal use only
 */
export class RecoveryData {
  constructor(json: JSON | any) {
    if (!json.recipient || !json.encryptedSelf || !json.type)
      throw new Error(`Recovery data json is missing required properties.\n${JSON.stringify(json)}`)
    Object.assign(this as RecoveryData, json)
  }

  id?: string
  rev?: string
  /**
   * Id of the data owner that this recovery data is meant for
   */
  recipient!: string
  /**
   * Encrypted recovery data. The structure of the decrypted data depends on the [type] of the recovery data.
   */
  encryptedSelf!: string
  /**
   * Type of the recovery data.
   */
  type!: RecoveryData.Type
  /**
   * Timestamp (unix epoch in ms) at which this recovery data will expire. If null, this recovery data will never
   * expire. Negative values or zero mean the data is already expired.
   */
  expirationInstant?: number
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when the delete method is called.
   */
  deletionDate?: number
}
export namespace RecoveryData {
  /**
   * Represents possible types of recovery data.
   */
  export enum Type {
    /**
     * This recovery data is meant to be used to recover a keypair of the recipient. This could be for making a key
     * available on another device, or for recovering a keypair that has been fully lost.
     */
    KEYPAIR_RECOVERY = 'KEYPAIR_RECOVERY',
    /**
     * This recovery data is meant to be used to recover an exchange key of the recipient. The main purpose of this
     * is to allow data owners to share data with other data owners that do not have created a keypair yet, but it
     * can also be used as part of the give-access-back recovery mechanism.
     */
    EXCHANGE_KEY_RECOVERY = 'EXCHANGE_KEY_RECOVERY',
  }
}
