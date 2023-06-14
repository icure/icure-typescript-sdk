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
  OAuthThirdParty,
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
import { IccDeviceApi } from '../icc-api'
import { IccCodeXApi } from './icc-code-x-api'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { LocalStorageImpl } from './storage/LocalStorageImpl'
import { KeyStorageImpl } from './storage/KeyStorageImpl'
import {
  AuthenticationProvider,
  BasicAuthenticationProvider,
  EnsembleAuthenticationProvider,
  JwtAuthenticationProvider,
  NoAuthenticationProvider,
} from './auth/AuthenticationProvider'
import { CryptoPrimitives } from './crypto/CryptoPrimitives'
import { KeyManager } from './crypto/KeyManager'
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
import { EntitiesEncryption } from './crypto/EntitiesEncryption'
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { ensureDelegationForSelf } from './crypto/utils'
import { CryptoActorStub, CryptoActorStubWithType } from '../icc-api/model/CryptoActorStub'

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

export type ApiOptions = {
  readonly entryKeysFactory?: StorageEntryKeysFactory
  readonly createMaintenanceTasksOnNewKey?: boolean
  readonly storage?: StorageFacade<string>
  readonly keyStorage?: KeyStorageFacade
  readonly headers?: { [headerName: string]: string }
}

class NamedApiParametersWithDefault implements ApiOptions {
  constructor(custom: ApiOptions) {
    this.entryKeysFactory = custom.entryKeysFactory ?? new DefaultStorageEntryKeysFactory()
    this.createMaintenanceTasksOnNewKey = custom.createMaintenanceTasksOnNewKey ?? false
    this.storage = custom.storage ?? new LocalStorageImpl()
    this.keyStorage = custom.keyStorage ?? new KeyStorageImpl(this.storage)
    this.headers = custom.headers ?? {}
  }

  readonly entryKeysFactory: StorageEntryKeysFactory
  readonly createMaintenanceTasksOnNewKey: boolean
  readonly storage: StorageFacade<string>
  readonly keyStorage: KeyStorageFacade
  readonly headers: { [headerName: string]: string }
}

export type AuthenticationDetails = {
  username: string
  password: string
  forceBasic?: boolean // default false
  icureTokens?: { token: string; refreshToken: string }
  thirdPartyTokens: { [thirdParty: string]: string }
}

export const Api = async function (
  host: string,
  authenticationOptions: AuthenticationDetails | AuthenticationProvider,
  cryptoStrategies: CryptoStrategies,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
    ? window.fetch
    : typeof self !== 'undefined'
    ? self.fetch
    : fetch,
  options: ApiOptions = {}
): Promise<Apis> {
  const params = new NamedApiParametersWithDefault(options)
  let authenticationProvider: AuthenticationProvider
  if ('username' in authenticationOptions && 'password' in authenticationOptions) {
    authenticationProvider = new EnsembleAuthenticationProvider(
      new IccAuthApi(host, params.headers, new NoAuthenticationProvider(), fetchImpl),
      authenticationOptions.username,
      authenticationOptions.password,
      3600,
      authenticationOptions.thirdPartyTokens
    )
  } else if ('icureTokens' in authenticationOptions) {
    new JwtAuthenticationProvider(
      new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetchImpl),
      undefined,
      undefined,
      authenticationOptions.icureTokens
    )
  } else {
    authenticationProvider = authenticationOptions as AuthenticationProvider
  }

  // Here I instantiate a separate instance of the AuthApi that can call also login-protected methods (logout)
  const authApi = new IccAuthApi(host, params.headers, authenticationProvider, fetchImpl)
  const codeApi = new IccCodeXApi(host, params.headers, authenticationProvider, fetchImpl)
  const entityReferenceApi = new IccEntityrefApi(host, params.headers, authenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, params.headers, authenticationProvider, fetchImpl)
  const permissionApi = new IccPermissionApi(host, params.headers, authenticationProvider, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, params.headers, authenticationProvider, fetchImpl)
  const deviceApi = new IccDeviceApi(host, params.headers, authenticationProvider, fetchImpl)
  const basePatientApi = new IccPatientApi(host, params.headers, authenticationProvider, fetchImpl)
  const dataOwnerApi = new IccDataOwnerXApi(host, params.headers, authenticationProvider, fetchImpl)
  // Crypto initialisation
  const icureStorage = new IcureStorageFacade(params.keyStorage, params.storage, params.entryKeysFactory)
  const cryptoPrimitives = new CryptoPrimitives(crypto)
  const baseExchangeKeysManager = new BaseExchangeKeysManager(cryptoPrimitives, dataOwnerApi, healthcarePartyApi, basePatientApi, deviceApi)
  const keyRecovery = new KeyRecovery(cryptoPrimitives, baseExchangeKeysManager, dataOwnerApi)
  const keyManager = new KeyManager(cryptoPrimitives, dataOwnerApi, icureStorage, keyRecovery, baseExchangeKeysManager, cryptoStrategies)
  const newKey = await keyManager.initialiseKeys()
  await new TransferKeysManager(cryptoPrimitives, baseExchangeKeysManager, dataOwnerApi, keyManager, icureStorage).updateTransferKeys(
    CryptoActorStubWithType.fromDataOwner(await dataOwnerApi.getCurrentDataOwner())
  )
  // TODO customise cache size?
  const exchangeKeysManager = new ExchangeKeysManager(
    100,
    500,
    60000,
    600000,
    cryptoStrategies,
    cryptoPrimitives,
    keyManager,
    baseExchangeKeysManager,
    dataOwnerApi,
    icureStorage
  )
  const entitiesEncryption = new EntitiesEncryption(cryptoPrimitives, dataOwnerApi, exchangeKeysManager)
  const shamirManager = new ShamirKeysManager(cryptoPrimitives, dataOwnerApi, keyManager, exchangeKeysManager)
  const confidentialEntitites = new ConfidentialEntities(entitiesEncryption, cryptoPrimitives, dataOwnerApi)
  await ensureDelegationForSelf(dataOwnerApi, entitiesEncryption, cryptoPrimitives, basePatientApi)
  const cryptoApi = new IccCryptoXApi(
    exchangeKeysManager,
    cryptoPrimitives,
    keyManager,
    dataOwnerApi,
    entitiesEncryption,
    shamirManager,
    params.storage,
    params.keyStorage,
    icureStorage,
    healthcarePartyApi,
    confidentialEntitites
  )
  const accessLogApi = new IccAccesslogXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const agendaApi = new IccAgendaApi(host, params.headers, authenticationProvider, fetchImpl)
  const contactApi = new IccContactXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const formApi = new IccFormXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const groupApi = new IccGroupApi(host, params.headers, authenticationProvider)
  const medicalLocationApi = new IccMedicallocationApi(host, params.headers, authenticationProvider)
  const calendarItemTypeApi = new IccCalendarItemTypeApi(host, params.headers, authenticationProvider)
  const invoiceApi = new IccInvoiceXApi(host, params.headers, cryptoApi, entityReferenceApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const insuranceApi = new IccInsuranceApi(host, params.headers, authenticationProvider, fetchImpl)
  const documentApi = new IccDocumentXApi(host, params.headers, cryptoApi, authApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const healthcareElementApi = new IccHelementXApi(
    host,
    params.headers,
    cryptoApi,
    dataOwnerApi,
    ['descr', 'note'],
    authenticationProvider,
    fetchImpl
  )
  const classificationApi = new IccClassificationXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const calendarItemApi = new IccCalendarItemXApi(
    host,
    params.headers,
    cryptoApi,
    dataOwnerApi,
    ['details', 'title', 'patientId'],
    authenticationProvider,
    fetchImpl
  )
  const receiptApi = new IccReceiptXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const timetableApi = new IccTimeTableXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const patientApi = new IccPatientXApi(
    host,
    params.headers,
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
  const messageApi = new IccMessageXApi(host, params.headers, cryptoApi, dataOwnerApi, authenticationProvider, fetchImpl)
  const maintenanceTaskApi = new IccMaintenanceTaskXApi(
    host,
    params.headers,
    cryptoApi,
    healthcarePartyApi,
    dataOwnerApi,
    ['properties'],
    authenticationProvider,
    fetchImpl
  )
  const icureMaintenanceTaskApi = new IccIcureMaintenanceXApi(cryptoApi, maintenanceTaskApi, dataOwnerApi)

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
  forceBasic: boolean = false
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
