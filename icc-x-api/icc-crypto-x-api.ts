import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { ExchangeKeysManager } from './crypto/ExchangeKeysManager'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { UserEncryptionKeysManager } from './crypto/UserEncryptionKeysManager'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { ExtendedApisUtils } from './crypto/ExtendedApisUtils'
import { IcureStorageFacade } from './storage/IcureStorageFacade'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'
import { IccHcpartyApi } from '../icc-api'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { ExchangeDataManager } from './crypto/ExchangeDataManager'
import { AccessControlKeysHeadersProvider } from './crypto/AccessControlKeysHeadersProvider'

export class IccCryptoXApi {
  keychainLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain.'
  keychainValidityDateLocalStoreIdPrefix = 'org.taktik.icure.ehealth.keychain-date.'
  hcpPreferenceKeyEhealthCert = 'eHealthCRTCrypt'
  hcpPreferenceKeyEhealthCertDate = 'eHealthCRTDate'
  rsaLocalStoreIdPrefix = 'org.taktik.icure.rsa.'
  private readonly exchangeKeysManager: ExchangeKeysManager
  private readonly cryptoPrimitives: CryptoPrimitives
  private readonly keyManager: UserEncryptionKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly xapiUtils: ExtendedApisUtils
  private readonly confidentialEntities: ConfidentialEntities
  private readonly icureStorage: IcureStorageFacade
  private readonly shamirManager: ShamirKeysManager
  private readonly _storage: StorageFacade<string>
  private readonly _keyStorage: KeyStorageFacade
  private readonly exchangeDataManager: ExchangeDataManager
  private readonly _accessControlKeysHeaders: AccessControlKeysHeadersProvider

  private readonly hcpartyBaseApi: IccHcpartyApi

  /**
   * The instance of {@link CryptoPrimitives} used by this instance of the iCure SDK.
   */
  get primitives(): CryptoPrimitives {
    return this.cryptoPrimitives
  }

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  get exchangeKeys(): ExchangeKeysManager {
    return this.exchangeKeysManager
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
    return this.exchangeDataManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get confidential(): ConfidentialEntities {
    return this.confidentialEntities
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
    return this.keyManager
  }

  /**
   * @internal this is for internal use only and may be changed without notice.
   */
  get shamirKeysManager(): ShamirKeysManager {
    return this.shamirManager
  }

  /**
   * @internal
   */
  constructor(
    exchangeKeysManager: ExchangeKeysManager,
    cryptoPrimitives: CryptoPrimitives,
    keyManager: UserEncryptionKeysManager,
    dataOwnerApi: IccDataOwnerXApi,
    entitiesEncrypiton: ExtendedApisUtils,
    shamirManager: ShamirKeysManager,
    storage: StorageFacade<string>,
    keyStorage: KeyStorageFacade,
    icureStorageFacade: IcureStorageFacade,
    hcPartyBaseApi: IccHcpartyApi,
    confidentialEntities: ConfidentialEntities,
    exchangeDataManager: ExchangeDataManager,
    accessControlKeysHeaders: AccessControlKeysHeadersProvider
  ) {
    this.exchangeKeysManager = exchangeKeysManager
    this.cryptoPrimitives = cryptoPrimitives
    this.keyManager = keyManager
    this.dataOwnerApi = dataOwnerApi
    this.xapiUtils = entitiesEncrypiton
    this.shamirManager = shamirManager
    this._storage = storage
    this._keyStorage = keyStorage
    this.icureStorage = icureStorageFacade
    this.hcpartyBaseApi = hcPartyBaseApi
    this.confidentialEntities = confidentialEntities
    this.exchangeDataManager = exchangeDataManager
    this._accessControlKeysHeaders = accessControlKeysHeaders
  }

  /**
   * Deletes values cached by the crypto api, to allow to detect changes in stored key pairs, exchange keys and/or current data owner details.
   * This method may be useful in cases where a user is logged in from multiple devices or in cases where other users have just shared some data with
   * the current user for the first time.
   */
  async forceReload() {
    this.exchangeKeysManager.clearCache(true)
    this.dataOwnerApi.clearCurrentDataOwnerIdsCache()
    await this.keyManager.reloadKeys()
    await this.exchangeDataManager.clearOrRepopulateCache()
  }
}
