export class ExchangeDataMapCreationBatch {
  constructor(json: JSON | any) {
    Object.assign(this as ExchangeDataMapCreationBatch, json)
  }

  /**
   * Each entry of this map can be used to create a new ExchangeDataMap. Each key is the hex-encoded hash of a secure
   * delegation key while the value is another map that associated the encrypted ExchangeData id to the fingerprint
   * of the public key used to encrypt it.
   */
  batch?: { [key: string]: { [key: string]: string } }
}
