import {
  IccAgendaApi,
  IccAuthApi,
  IccCalendarItemTypeApi,
  IccEntityrefApi,
  IccGroupApi,
  IccInsuranceApi,
  IccMedicallocationApi,
  IccPatientApi,
  IccPermissionApi,
} from '../icc-api'
import { IccUserXApi } from './icc-user-x-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccContactXApi } from './icc-contact-x-api'
import { IccInvoiceXApi } from './icc-invoice-x-api'
import { IccDocumentXApi } from './icc-document-x-api'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { IccFormXApi } from './icc-form-x-api'
import { IccHelementXApi } from './icc-helement-x-api'
import { IccClassificationXApi } from './icc-classification-x-api'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { IccPatientXApi } from './icc-patient-x-api'
import { IccMessageXApi } from './icc-message-x-api'
import { IccReceiptXApi } from './icc-receipt-x-api'
import { IccAccesslogXApi } from './icc-accesslog-x-api'
import { IccTimeTableXApi } from './icc-time-table-x-api'
import { IccDeviceApi } from '../icc-api/api/IccDeviceApi'
import { IccCodeXApi } from './icc-code-x-api'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { retry } from './utils'
import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { LocalStorageImpl } from './storage/LocalStorageImpl'
import { KeyStorageImpl } from './storage/KeyStorageImpl'
import { BasicAuthenticationProvider, EnsembleAuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { UserEncryptionKeysManager } from './crypto/UserEncryptionKeysManager'
import { IcureStorageFacade } from './storage/IcureStorageFacade'
import { DefaultStorageEntryKeysFactory } from './storage/DefaultStorageEntryKeysFactory'
import { KeyRecovery } from './crypto/KeyRecovery'
import { BaseExchangeKeysManager } from './crypto/BaseExchangeKeysManager'
import { StorageEntryKeysFactory } from './storage/StorageEntryKeysFactory'
import { CryptoStrategies } from './crypto/CryptoStrategies'
import { ExchangeKeysManager } from './crypto/ExchangeKeysManager'
import { ShamirKeysManager } from './crypto/ShamirKeysManager'
import { TransferKeysManager } from './crypto/TransferKeysManager'
import { IccIcureMaintenanceXApi } from './icc-icure-maintenance-x-api'
import { ExtendedApisUtils } from './crypto/ExtendedApisUtils'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { LegacyCryptoStrategies } from './crypto/LegacyCryptoStrategies'
import { ensureDelegationForSelf } from './crypto/utils'
import { SecurityMetadataDecryptorChain } from './crypto/SecurityMetadataDecryptor'
import { SecureDelegationsSecurityMetadataDecryptor } from './crypto/SecureDelegationsSecurityMetadataDecryptor'
import { initialiseExchangeDataManagerForCurrentDataOwner } from './crypto/ExchangeDataManager'
import { BaseExchangeDataManager } from './crypto/BaseExchangeDataManager'
import { IccExchangeDataApi } from '../icc-api/api/IccExchangeDataApi'
import { UserSignatureKeysManager } from './crypto/UserSignatureKeysManager'
import { AccessControlSecretUtils } from './crypto/AccessControlSecretUtils'
import { SecureDelegationsEncryption } from './crypto/SecureDelegationsEncryption'
import { LegacyDelegationSecurityMetadataDecryptor } from './crypto/LegacyDelegationSecurityMetadataDecryptor'
import { ExtendedApisUtilsImpl } from './crypto/ExtendedApisUtilsImpl'
import { SecureDelegationsManager } from './crypto/SecureDelegationsManager'

export * from './icc-accesslog-x-api'
export * from './icc-bekmehr-x-api'
export * from './icc-calendar-item-x-api'
export * from './icc-classification-x-api'
export * from './icc-code-x-api'
export * from './icc-contact-x-api'
export * from './icc-crypto-x-api'
export * from './icc-doctemplate-x-api'
export * from './icc-document-x-api'
export * from './icc-form-x-api'
export * from './icc-hcparty-x-api'
export * from './icc-helement-x-api'
export * from './icc-invoice-x-api'
export * from './icc-message-x-api'
export * from './icc-patient-x-api'
export * from './icc-user-x-api'
export * from './icc-time-table-x-api'
export * from './icc-receipt-x-api'
export * from './utils'
export { KeyStorageFacade } from './storage/KeyStorageFacade'
export { LocalStorageImpl } from './storage/LocalStorageImpl'
export { StorageFacade } from './storage/StorageFacade'
export { KeyStorageImpl } from './storage/KeyStorageImpl'

export interface Apis {
  authApi: IccAuthApi
  codeApi: IccCodeXApi
  calendarItemTypeApi: IccCalendarItemTypeApi
  medicalLocationApi: IccMedicallocationApi
  entityReferenceApi: IccEntityrefApi
  userApi: IccUserXApi
  permissionApi: IccPermissionApi
  healthcarePartyApi: IccHcpartyXApi
  deviceApi: IccDeviceApi
  cryptoApi: IccCryptoXApi
  accessLogApi: IccAccesslogXApi
  agendaApi: IccAgendaApi
  contactApi: IccContactXApi
  formApi: IccFormXApi
  groupApi: IccGroupApi
  invoiceApi: IccInvoiceXApi
  insuranceApi: IccInsuranceApi
  documentApi: IccDocumentXApi
  healthcareElementApi: IccHelementXApi
  classificationApi: IccClassificationXApi
  calendarItemApi: IccCalendarItemXApi
  receiptApi: IccReceiptXApi
  timetableApi: IccTimeTableXApi
  patientApi: IccPatientXApi
  messageApi: IccMessageXApi
  maintenanceTaskApi: IccMaintenanceTaskXApi
  dataOwnerApi: IccDataOwnerXApi
  icureMaintenanceTaskApi: IccIcureMaintenanceXApi
}

export type NamedApiParameters = {
  readonly entryKeysFactory?: StorageEntryKeysFactory
  readonly cryptoStrategies?: CryptoStrategies
  readonly createMaintenanceTasksOnNewKey?: boolean
}

class NamedApiParametersWithDefault implements NamedApiParameters {
  constructor(custom: NamedApiParameters) {
    this.entryKeysFactory = custom.entryKeysFactory ?? new DefaultStorageEntryKeysFactory()
    this.cryptoStrategies = custom.cryptoStrategies ?? new LegacyCryptoStrategies()
    this.createMaintenanceTasksOnNewKey = custom.createMaintenanceTasksOnNewKey ?? false
  }

  readonly entryKeysFactory: StorageEntryKeysFactory
  readonly cryptoStrategies: CryptoStrategies
  readonly createMaintenanceTasksOnNewKey: boolean
}

export const Api = async function (
  host: string,
  username: string,
  password: string,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
    ? window.fetch
    : typeof self !== 'undefined'
    ? self.fetch
    : fetch,
  forceBasic: boolean = false,
  autoLogin: boolean = false,
  storage: StorageFacade<string> = new LocalStorageImpl(),
  keyStorage: KeyStorageFacade = new KeyStorageImpl(storage),
  namedParameters: NamedApiParameters = {}
): Promise<Apis> {
  const params = new NamedApiParametersWithDefault(namedParameters)
  const headers = {}
  const authenticationProvider = forceBasic
    ? new BasicAuthenticationProvider(username, password)
    : new EnsembleAuthenticationProvider(new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl), username, password)

  // Here I instantiate a separate instance of the AuthApi that can call also login-protected methods (logout)
  const authApi = new IccAuthApi(host, headers, authenticationProvider, fetchImpl)
  const codeApi = new IccCodeXApi(host, headers, authenticationProvider, fetchImpl)
  const entityReferenceApi = new IccEntityrefApi(host, headers, authenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, headers, authenticationProvider, fetchImpl)
  const permissionApi = new IccPermissionApi(host, headers, authenticationProvider, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, headers, authenticationProvider, fetchImpl)
  const deviceApi = new IccDeviceApi(host, headers, authenticationProvider, fetchImpl)
  const basePatientApi = new IccPatientApi(host, headers, authenticationProvider, fetchImpl)
  const dataOwnerApi = new IccDataOwnerXApi(userApi, healthcarePartyApi, basePatientApi, deviceApi)
  const exchangeDataApi = new IccExchangeDataApi(host, headers, authenticationProvider, fetchImpl)
  // Crypto initialisation
  const icureStorage = new IcureStorageFacade(keyStorage, storage, params.entryKeysFactory)
  const cryptoPrimitives = new CryptoPrimitives(crypto)
  const baseExchangeKeysManager = new BaseExchangeKeysManager(cryptoPrimitives, dataOwnerApi, healthcarePartyApi, basePatientApi, deviceApi)
  const keyRecovery = new KeyRecovery(cryptoPrimitives, baseExchangeKeysManager, dataOwnerApi)
  const userEncryptionKeysManager = new UserEncryptionKeysManager(
    cryptoPrimitives,
    dataOwnerApi,
    icureStorage,
    keyRecovery,
    baseExchangeKeysManager,
    params.cryptoStrategies
  )
  const userSignatureKeysManager = new UserSignatureKeysManager(icureStorage, dataOwnerApi, cryptoPrimitives)
  const newKey = await userEncryptionKeysManager.initialiseKeys()
  await new TransferKeysManager(cryptoPrimitives, baseExchangeKeysManager, dataOwnerApi, userEncryptionKeysManager, icureStorage).updateTransferKeys(
    await dataOwnerApi.getCurrentDataOwner()
  )
  // TODO customise cache size?
  const exchangeKeysManager = new ExchangeKeysManager(
    100,
    500,
    60000,
    600000,
    params.cryptoStrategies,
    cryptoPrimitives,
    userEncryptionKeysManager,
    baseExchangeKeysManager,
    dataOwnerApi,
    icureStorage
  )
  const accessControlSecretUtils = new AccessControlSecretUtils(cryptoPrimitives)
  const baseExchangeDataManager = new BaseExchangeDataManager(exchangeDataApi, dataOwnerApi, cryptoPrimitives, params.cryptoStrategies)
  const exchangeDataManager = await initialiseExchangeDataManagerForCurrentDataOwner(
    baseExchangeDataManager,
    userEncryptionKeysManager,
    userSignatureKeysManager,
    accessControlSecretUtils,
    params.cryptoStrategies,
    dataOwnerApi,
    cryptoPrimitives
  )
  const secureDelegationsEncryption = new SecureDelegationsEncryption(userEncryptionKeysManager, cryptoPrimitives)
  const xApiUtils = new ExtendedApisUtilsImpl(
    cryptoPrimitives,
    dataOwnerApi,
    exchangeKeysManager,
    new LegacyDelegationSecurityMetadataDecryptor(exchangeKeysManager, cryptoPrimitives),
    new SecureDelegationsSecurityMetadataDecryptor(exchangeDataManager, secureDelegationsEncryption),
    new SecureDelegationsManager(
      exchangeDataManager,
      secureDelegationsEncryption,
      accessControlSecretUtils,
      userEncryptionKeysManager,
      cryptoPrimitives,
      dataOwnerApi,
      params.cryptoStrategies,
      params.cryptoStrategies.dataOwnerRequiresAnonymousDelegation(await dataOwnerApi.getCurrentDataOwner())
    ),
    userApi
  )
  const shamirManager = new ShamirKeysManager(cryptoPrimitives, dataOwnerApi, userEncryptionKeysManager, exchangeKeysManager)
  const confidentialEntitites = new ConfidentialEntities(xApiUtils, cryptoPrimitives, dataOwnerApi)
  await ensureDelegationForSelf(dataOwnerApi, xApiUtils, basePatientApi, cryptoPrimitives)
  const cryptoApi = new IccCryptoXApi(
    exchangeKeysManager,
    cryptoPrimitives,
    userEncryptionKeysManager,
    dataOwnerApi,
    xApiUtils,
    shamirManager,
    storage,
    keyStorage,
    icureStorage,
    healthcarePartyApi,
    confidentialEntitites,
    exchangeDataManager
  )
  const accessLogApi = new IccAccesslogXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const agendaApi = new IccAgendaApi(host, headers, authenticationProvider, fetchImpl)
  const contactApi = new IccContactXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const formApi = new IccFormXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const groupApi = new IccGroupApi(host, headers, authenticationProvider)
  const medicalLocationApi = new IccMedicallocationApi(host, headers, authenticationProvider)
  const calendarItemTypeApi = new IccCalendarItemTypeApi(host, headers, authenticationProvider)
  const invoiceApi = new IccInvoiceXApi(host, headers, cryptoApi, entityReferenceApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const insuranceApi = new IccInsuranceApi(host, headers, authenticationProvider, fetchImpl)
  const documentApi = new IccDocumentXApi(host, headers, cryptoApi, authApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const healthcareElementApi = new IccHelementXApi(host, headers, cryptoApi, dataOwnerApi, ['descr', 'note'], authenticationProvider, fetchImpl)
  const classificationApi = new IccClassificationXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const calendarItemApi = new IccCalendarItemXApi(
    host,
    headers,
    cryptoApi,
    dataOwnerApi,
    ['details', 'title', 'patientId'],
    authenticationProvider,
    fetchImpl
  )
  const receiptApi = new IccReceiptXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const timetableApi = new IccTimeTableXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const patientApi = new IccPatientXApi(
    host,
    headers,
    cryptoApi,
    contactApi,
    formApi,
    healthcareElementApi,
    invoiceApi,
    documentApi,
    healthcarePartyApi,
    classificationApi,
    dataOwnerApi,
    calendarItemApi,
    ['note'],
    authenticationProvider,
    fetchImpl
  )
  const messageApi = new IccMessageXApi(host, headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const maintenanceTaskApi = new IccMaintenanceTaskXApi(
    host,
    headers,
    cryptoApi,
    healthcarePartyApi,
    dataOwnerApi,
    ['properties'],
    authenticationProvider,
    fetchImpl
  )
  const icureMaintenanceTaskApi = new IccIcureMaintenanceXApi(cryptoApi, maintenanceTaskApi, dataOwnerApi, exchangeDataApi)

  if (autoLogin) {
    if (username != undefined && password != undefined) {
      try {
        await retry(() => authApi.login({ username, password }), 3, 1000, 1.5)
      } catch (e) {
        console.error('Incorrect user and password used to instantiate Api, or network problem', e)
      }
    }
  } else {
    console.info('Auto login skipped')
  }
  if (newKey && params.createMaintenanceTasksOnNewKey) {
    await icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(await userApi.getCurrentUser(), newKey.newKeyPair)
  }
  return {
    cryptoApi,
    authApi,
    codeApi,
    calendarItemTypeApi,
    medicalLocationApi,
    userApi,
    permissionApi,
    patientApi,
    healthcarePartyApi,
    deviceApi,
    accessLogApi,
    contactApi,
    healthcareElementApi,
    documentApi,
    formApi,
    invoiceApi,
    insuranceApi,
    messageApi,
    entityReferenceApi,
    receiptApi,
    agendaApi,
    calendarItemApi,
    classificationApi,
    timetableApi,
    groupApi,
    maintenanceTaskApi,
    dataOwnerApi,
    icureMaintenanceTaskApi,
  }
}

export const BasicApis = async function (
  host: string,
  username: string,
  password: string,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
    ? window.fetch
    : typeof self !== 'undefined'
    ? self.fetch
    : fetch,
  forceBasic: boolean = false,
  autoLogin: boolean = false
) {
  const headers = {}
  const authenticationProvider = forceBasic
    ? new BasicAuthenticationProvider(username, password)
    : new EnsembleAuthenticationProvider(new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl), username, password)
  const authApi = new IccAuthApi(host, headers, authenticationProvider, fetchImpl)

  const codeApi = new IccCodeXApi(host, headers, authenticationProvider, fetchImpl)
  const entityReferenceApi = new IccEntityrefApi(host, headers, authenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, headers, authenticationProvider, fetchImpl)
  const permissionApi = new IccPermissionApi(host, headers, authenticationProvider, fetchImpl)
  const agendaApi = new IccAgendaApi(host, headers, authenticationProvider, fetchImpl)
  const groupApi = new IccGroupApi(host, headers, authenticationProvider)
  const insuranceApi = new IccInsuranceApi(host, headers, authenticationProvider, fetchImpl)

  if (autoLogin) {
    if (username != undefined && password != undefined) {
      try {
        await retry(() => authApi.login({ username, password }), 3, 1000, 1.5)
      } catch (e) {
        console.error('Incorrect user and password used to instantiate Api, or network problem', e)
      }
    }
  } else {
    console.info('Auto login skipped')
  }

  return {
    authApi,
    codeApi,
    userApi,
    permissionApi,
    insuranceApi,
    entityReferenceApi,
    agendaApi,
    groupApi,
  }
}
