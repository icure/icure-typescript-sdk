import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { ExchangeKeysManager } from './crypto/ExchangeKeysManager'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { UserEncryptionKeysManager } from './crypto/UserEncryptionKeysManager'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { ExtendedApisUtils } from './crypto/ExtendedApisUtils'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { ExchangeDataManager } from './crypto/ExchangeDataManager'
import { AccessControlKeysHeadersProvider } from './crypto/AccessControlKeysHeadersProvider'
import { KeyPair } from './crypto/RSA'

export class IccCryptoXApi {
  /**
   * The instance of {@link CryptoPrimitives} used by this instance of the iCure SDK.
   */
  get primitives(): CryptoPrimitives {
    return this._cryptoPrimitives
  }

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  get exchangeKeys(): ExchangeKeysManager {
    return this._exchangeKeysManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get keyStorage(): KeyStorageFacade {
    return this._keyStorage
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get storage(): StorageFacade<string> {
    return this._storage
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get xapi(): ExtendedApisUtils {
    return this.xapiUtils
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get exchangeData(): ExchangeDataManager {
    return this._exchangeDataManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get confidential(): ConfidentialEntities {
    return this._confidentialEntities
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get accessControlKeysHeaders(): AccessControlKeysHeadersProvider {
    return this._accessControlKeysHeaders
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get userKeysManager(): UserEncryptionKeysManager {
    return this._keyManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get shamirKeysManager(): ShamirKeysManager {
    return this._shamirManager
  }

  /**
   * @internal
   */
  constructor(
    private readonly _exchangeKeysManager: ExchangeKeysManager,
    private readonly _cryptoPrimitives: CryptoPrimitives,
    private readonly _keyManager: UserEncryptionKeysManager,
    private readonly _dataOwnerApi: IccDataOwnerXApi,
    private readonly xapiUtils: ExtendedApisUtils,
    private readonly _shamirManager: ShamirKeysManager,
    private readonly _storage: StorageFacade<string>,
    private readonly _keyStorage: KeyStorageFacade,
    private readonly _confidentialEntities: ConfidentialEntities,
    private readonly _exchangeDataManager: ExchangeDataManager,
    private readonly _accessControlKeysHeaders: AccessControlKeysHeadersProvider
  ) {}

  /**
   * Deletes values cached by the crypto api, to allow to detect changes in stored key pairs, exchange keys and/or current data owner details.
   * This method may be useful in cases where a user is logged in from multiple devices or in cases where other users have just shared some data with
   * the current user for the first time.
   */
  async forceReload() {
    this._exchangeKeysManager.clearCache(true)
    this._dataOwnerApi.clearCurrentDataOwnerIdsCache()
    await this._keyManager.reloadKeys()
    await this._exchangeDataManager.clearOrRepopulateCache()
  }

  /**
   * Get all key pairs available for the decrpytion and encryption of data to the current data owner. These include the key pairs from the data owner
   * and his parents.
   * @return an object with:
   * - `self` an object containing the current data owner id and the list of key pairs available for the current data owner with verification details.
   * - `parents` the list of parents to the current data owner with the list of key pairs available for each parent. The list is ordered from the
   *   topmost ancestor (at index 0) to the direct parent of the current data owner (at the last index, may be 0).
   */
  getEncryptionDecryptionKeypairsForDataOwnerHierarchy(): Promise<{
    self: {
      dataOwnerId: string
      keys: { pair: KeyPair<CryptoKey>; verified: boolean }[]
    }
    parents: {
      dataOwnerId: string
      keys: { pair: KeyPair<CryptoKey> }[]
    }[]
  }> {
    return this._keyManager.getCurrentUserHierarchyAvailableKeypairs()
  }

  /**
   * Get a key pair with the provided fingerprint if present.
   * @param fingerprint a key-pair/public-key fingerprint
   * @return the pair associated to the fingerprint and a boolean indicating if the pair is verified, if present, else undefined
   */
  getKeyPairForFingerprint(fingerprint: string): { pair: KeyPair<CryptoKey>; verified: boolean } | undefined {
    return this._keyManager.getKeyPairForFingerprint(fingerprint)
  }

  /**
   * Get the public keys of available key pairs for the current user and his parents in hex-encoded spki representation (uses cached keys: no request
   * is done to the server).
   * Note that this will also include unverified keys.
   * @return the spki representation of public keys of available keypairs for the current user.
   */
  async getCurrentUserHierarchyAvailablePublicKeysHex(): Promise<string[]> {
    return this._keyManager.getCurrentUserHierarchyAvailablePublicKeysHex()
  }

  /**
   * Get the public keys of available key pairs for the current user in hex-encoded spki representation (uses cached keys: no request is done to the
   * server).
   * By setting {@link verifiedOnly} to true only the public keys for verified key pairs will be returned: these will include only key pairs created
   * on this device or which have been verified using {@link CryptoStrategies} on this device.
   * @param verifiedOnly if true only the verified public keys will be returned.
   * @return the spki representation of public keys of available keypairs for the current user.
   */
  async getCurrentUserAvailablePublicKeysHex(verifiedOnly: boolean): Promise<string[]> {
    return this._keyManager.getCurrentUserAvailablePublicKeysHex(verifiedOnly)
  }
}
