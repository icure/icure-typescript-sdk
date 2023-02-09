import { KeyStorageFacade } from './KeyStorageFacade'
import { StorageFacade } from './StorageFacade'
import { StorageEntryKeysFactory } from './StorageEntryKeysFactory'
import { KeyPair } from '../crypto/RSA'

/**
 * @internal This class is meant for internal use only and may be changed without notice.
 * Simplifies access to the storage facades for iCure-specific data storage.
 */
export class IcureStorageFacade {
  private readonly keys: KeyStorageFacade
  private readonly data: StorageFacade<string>
  private readonly entryFor: StorageEntryKeysFactory

  constructor(keyStorage: KeyStorageFacade, storage: StorageFacade<string>, entryKeysFactory: StorageEntryKeysFactory) {
    this.keys = keyStorage
    this.data = storage
    this.entryFor = entryKeysFactory
  }

  /**
   * Saves a key pair for the data owner.
   * @param dataOwnerId id of the data owner with the key.
   * @param publicKeyFingerprint fingerprint of the public key of the pair.
   * @param keyPair a key pair of the data owner.
   * @param isDevice true if the key was generated on this device.
   */
  async saveKey(dataOwnerId: string, publicKeyFingerprint: string, keyPair: KeyPair<JsonWebKey>, isDevice: boolean): Promise<void> {
    const key = isDevice
      ? this.entryFor.deviceKeypairOfDataOwner(dataOwnerId, publicKeyFingerprint)
      : this.entryFor.cachedRecoveredKeypairOfDataOwner(dataOwnerId, publicKeyFingerprint)
    await this.keys.storeKeyPair(key, keyPair)
  }

  /**
   * Get an existing key pair for the data owner.
   * @param dataOwnerId id of the data owner with the key.
   * @param publicKeyFingerprint fingerprint of a public key of the data owner.
   * @param legacyPublicKey the legacy public key of the data owner, if present
   * @return the keypair and if the key was generated on this device or undefined if the key pair could not be found.
   */
  async loadKey(
    dataOwnerId: string,
    publicKeyFingerprint: string,
    legacyPublicKey: string | undefined
  ): Promise<{ pair: KeyPair<JsonWebKey>; isDevice: boolean } | undefined> {
    const deviceKey =
      (await this.keys.getKeypair(this.entryFor.deviceKeypairOfDataOwner(dataOwnerId, publicKeyFingerprint))) ??
      (await this.keys.getKeypair(`org.taktik.icure.rsa.${dataOwnerId}.${publicKeyFingerprint}`)) ??
      (legacyPublicKey?.slice(-32) === publicKeyFingerprint ? await this.keys.getKeypair(`org.taktik.icure.rsa.${dataOwnerId}`) : undefined)
    if (deviceKey) return { pair: deviceKey, isDevice: true }
    const cachedKey = await this.keys.getKeypair(this.entryFor.cachedRecoveredKeypairOfDataOwner(dataOwnerId, publicKeyFingerprint))
    if (cachedKey) return { pair: cachedKey, isDevice: false }
    return undefined
  }

  /**
   * Save the results of public key verification. If there were already results stored the entries will be merged. In case of conflicts the new
   * {@link verificationDetails} take priority over the stored data.
   * @param dataOwnerId id of a data owner.
   * @param verificationDetails results of verification, associates key fingerprints to true if they were verified by the user or false otherwise.
   * @return the udpated keys
   */
  async saveSelfVerifiedKeys(
    dataOwnerId: string,
    verificationDetails: { [keyFingerprint: string]: boolean }
  ): Promise<{ [keyFingerprint: string]: boolean }> {
    const updated = {
      ...(await this.loadSelfVerifiedKeys(dataOwnerId)),
      ...verificationDetails,
    }
    await this.data.setItem(this.entryFor.selfPublicKeysVerificationCacheForDataOwner(dataOwnerId), JSON.stringify(updated))
    return updated
  }

  /**
   * Get the last saved results of public key verification.
   * @param dataOwnerId id of a data owner.
   * @return saved results of verification, associates key fingerprints to true if they were verified by the user or false otherwise. If no results
   * were saved returns an empty object instead.
   * @throws if the stored results are not in a valid format.
   */
  async loadSelfVerifiedKeys(dataOwnerId: string): Promise<{ [keyFingerprint: string]: boolean }> {
    const dataString = await this.data.getItem(this.entryFor.selfPublicKeysVerificationCacheForDataOwner(dataOwnerId))
    if (dataString) {
      const parsed = JSON.parse(dataString)
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== true && v !== false) throw new Error(`Unexpected entry ${k}:${v}`)
      })
      return parsed
    } else return {}
  }

  /**
   * Saves a signature and verification key pair. Overrides previously saved signature keys (but keeps signature verification keys).
   * @param dataOwnerId id of the data owner with the key.
   * @param publicKeyFingerprint fingerprint of the public key of the pair.
   * @param keyPair the key pair to save.
   */
  async saveSignatureKeyPair(dataOwnerId: string, publicKeyFingerprint: string, keyPair: KeyPair<JsonWebKey>): Promise<void> {
    await this.keys.storeKeyPair(this.entryFor.signatureKeyForDataOwner(dataOwnerId), keyPair)
    await this.keys.storePublicKey(this.entryFor.signatureVerificationKeyForDataOwner(dataOwnerId, publicKeyFingerprint), keyPair.publicKey)
  }

  /**
   * Loads the signature key for the data owner.
   * @param dataOwnerId id of the data owner with the key.
   * @return the signature key for the data owner or undefined if there is no signature key stored.
   */
  async loadSignatureKey(dataOwnerId: string): Promise<KeyPair<JsonWebKey> | undefined> {
    return await this.keys.getKeypair(this.entryFor.signatureKeyForDataOwner(dataOwnerId))
  }

  /**
   * Loads the signature verification key for a data owner with the provided fingerprint.
   * @param dataOwnerId id of the data owner with the key.
   * @param publicKeyFingerprint fingerprint of the verification key.
   * @return the requested signature verification key or undefined if the key could not be found.
   */
  async loadSignatureVerificationKey(dataOwnerId: string, publicKeyFingerprint: string): Promise<JsonWebKey | undefined> {
    return await this.keys.getPublicKey(this.entryFor.signatureVerificationKeyForDataOwner(dataOwnerId, publicKeyFingerprint))
  }
}
