import {
  IccAgendaApi,
  IccAnonymousAccessApi,
  IccApplicationsettingsApi,
  IccArticleApi,
  IccAuthApi,
  IccBeefactApi,
  IccBeresultexportApi,
  IccBeresultimportApi,
  IccBesamv2Api,
  IccCalendarItemTypeApi,
  IccClassificationTemplateApi,
  IccEntityrefApi,
  IccEntitytemplateApi,
  IccFrontendmigrationApi,
  IccGroupApi,
  IccIcureApi,
  IccInsuranceApi,
  IccKeywordApi,
  IccMedexApi,
  IccMedicallocationApi,
  IccPatientApi,
  IccPermissionApi,
  IccPlaceApi,
  IccPubsubApi,
  IccReplicationApi,
  IccTarificationApi,
  IccTmpApi,
  IccUserApi,
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
import { IccCodeXApi } from './icc-code-x-api'
import { IccMaintenanceTaskXApi } from './icc-maintenance-task-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { StorageFacade } from './storage/StorageFacade'
import { KeyStorageFacade } from './storage/KeyStorageFacade'
import { LocalStorageImpl } from './storage/LocalStorageImpl'
import { KeyStorageImpl } from './storage/KeyStorageImpl'
import {
  AuthenticationProvider,
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
import { CryptoActorStubWithType } from '../icc-api/model/CryptoActorStub'
import { IccBekmehrXApi } from './icc-bekmehr-x-api'
import { IccDoctemplateXApi } from './icc-doctemplate-x-api'
import { UserGroup } from '../icc-api/model/UserGroup'
import { IccDeviceXApi } from './icc-device-x-api'
import { IccRoleApi } from '../icc-api/api/IccRoleApi'
import { JwtBridgedAuthService } from './auth/JwtBridgedAuthService'
import { AuthSecretProvider, SmartAuthProvider } from './auth/SmartAuthProvider'

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
export * from './icc-data-owner-x-api'
export * from './icc-icure-maintenance-x-api'
export * from './icc-maintenance-task-x-api'
export * from './utils'

export * from './crypto/RSA'
export * from './crypto/CryptoPrimitives'
export * from './crypto/ShareMetadataBehaviour'
export * from './auth/AuthenticationProvider'

export { KeyStorageFacade } from './storage/KeyStorageFacade'
export { LocalStorageImpl } from './storage/LocalStorageImpl'
export { StorageFacade } from './storage/StorageFacade'
export { KeyStorageImpl } from './storage/KeyStorageImpl'
export { CryptoStrategies } from './crypto/CryptoStrategies'

export interface BasicApis {
  readonly authApi: IccAuthApi
  readonly codeApi: IccCodeXApi
  readonly userApi: IccUserXApi
  readonly permissionApi: IccPermissionApi
  readonly insuranceApi: IccInsuranceApi
  readonly entityReferenceApi: IccEntityrefApi
  readonly agendaApi: IccAgendaApi
  readonly groupApi: IccGroupApi
  readonly healthcarePartyApi: IccHcpartyXApi
  readonly deviceApi: IccDeviceXApi
}
export interface Apis extends BasicApis {
  readonly calendarItemTypeApi: IccCalendarItemTypeApi
  readonly medicalLocationApi: IccMedicallocationApi
  readonly cryptoApi: IccCryptoXApi
  readonly accessLogApi: IccAccesslogXApi
  readonly contactApi: IccContactXApi
  readonly formApi: IccFormXApi
  readonly invoiceApi: IccInvoiceXApi
  readonly documentApi: IccDocumentXApi
  readonly healthcareElementApi: IccHelementXApi
  readonly classificationApi: IccClassificationXApi
  readonly calendarItemApi: IccCalendarItemXApi
  readonly receiptApi: IccReceiptXApi
  readonly timetableApi: IccTimeTableXApi
  readonly patientApi: IccPatientXApi
  readonly messageApi: IccMessageXApi
  readonly maintenanceTaskApi: IccMaintenanceTaskXApi
  readonly dataOwnerApi: IccDataOwnerXApi
  readonly icureMaintenanceTaskApi: IccIcureMaintenanceXApi
  readonly anonymousAccessApi: IccAnonymousAccessApi
  readonly applicationSettingsApi: IccApplicationsettingsApi
  readonly articleApi: IccArticleApi
  readonly bekmehrApi: IccBekmehrXApi
  readonly beefactApi: IccBeefactApi
  readonly beresultexportApi: IccBeresultexportApi
  readonly beresultimportApi: IccBeresultimportApi
  readonly besamv2Api: IccBesamv2Api
  readonly classificationTemplateApi: IccClassificationTemplateApi
  readonly doctemplateApi: IccDoctemplateXApi
  readonly entitytemplateApi: IccEntitytemplateApi
  readonly frontendmigrationApi: IccFrontendmigrationApi
  readonly icureApi: IccIcureApi
  readonly keywordApi: IccKeywordApi
  readonly medexApi: IccMedexApi
  readonly placeApi: IccPlaceApi
  readonly pubsubApi: IccPubsubApi
  readonly replicationApi: IccReplicationApi
  readonly tarificationApi: IccTarificationApi
  readonly tmpApi: IccTmpApi
  readonly roleApi: IccRoleApi
}

/**
 * Allows to customise the behaviour of the iCure API by providing various optional parameters.
 */
export interface IcureApiOptions {
  /**
   * Specifies how iCure can store string values (e.g. json). In production this should be persistent storage.
   * @default the browser's localStorage.
   */
  readonly storage?: StorageFacade<string>
  /**
   * Specifies how iCure can store cryptographic keys. Preferably this should be some ad-hoc storage key storage.
   * @default stores the json of the jwk representation of the key in {@link storage}.
   */
  readonly keyStorage?: KeyStorageFacade
  /**
   * Specifies where iCure should store his data within the {@link storage} and {@link keyStorage}.
   * @default {@link DefaultStorageEntryKeysFactory}
   */
  readonly entryKeysFactory?: StorageEntryKeysFactory
  /**
   * Specifies if iCure should create maintenance tasks for requesting access back when a new key is generated at initialisation time.
   * @default true
   */
  readonly createMaintenanceTasksOnNewKey?: boolean
  /**
   * Additional headers to use on each request made by the iCure api.
   * @default no additional headers
   */
  readonly headers?: { [headerName: string]: string }
  /**
   * Specifies which fields should be encrypted for each kind of encryptable entity. You should make sure that every application in your environment
   * specifies the same values for this configuration.
   * @default see documentation for {@link EncryptedFieldsConfig}
   */
  readonly encryptedFieldsConfig?: EncryptedFieldsConfig
  /**
   * Each user may exist in multiple groups, but an instance of {@link IcureApi} is specialised for a single group. This function allows you to decide
   * the group to use for a given user. This functions will be called only if a user exists in at least 2 groups, takes in input the information on
   * the groups the user can access (in no specific order) and must return the id of one of these groups.
   * @default takes the first group provided. The group chosen by this method may vary between different instantiations of the {@link IcureApi} even
   * if for the same user and if the groups available for the user do not change.
   */
  readonly groupSelector?: (availableGroupsInfo: UserGroup[]) => Promise<string>
  /**
   * Temporary value to support EHR Lite and MedTech api implementations.
   *
   * Currently, all hcps are able to access encrypted data shared with any of their parents, and on initialisation the api will verify that there is a
   * key pair available for the current user and for every parent of the user. If this option is set to true, the api will not load keys for the
   * parent users.
   *
   * This "implicit data-sharing scheme" (each parent HCP is essentially sharing data with all its children HCPs), however, may not be ideal for all
   * use cases, and it will be changed in future to be configurable in order to make it more general.
   * @default false, equivalent to previous behaviour.
   */
  readonly disableParentKeysInitialisation?: boolean
}
namespace IcureApiOptions {
  export namespace Defaults {
    export const entryKeysFactory = new DefaultStorageEntryKeysFactory()
    export const createMaintenanceTasksOnNewKey = true
    export const headers = {}
  }
  export class WithDefaults implements IcureApiOptions {
    constructor(custom: IcureApiOptions) {
      this.entryKeysFactory = custom.entryKeysFactory ?? Defaults.entryKeysFactory
      this.createMaintenanceTasksOnNewKey = custom.createMaintenanceTasksOnNewKey ?? Defaults.createMaintenanceTasksOnNewKey
      this.storage = custom.storage ?? new LocalStorageImpl()
      this.keyStorage = custom.keyStorage ?? new KeyStorageImpl(this.storage)
      this.headers = custom.headers ?? Defaults.headers
      this.encryptedFieldsConfig = custom.encryptedFieldsConfig ?? EncryptedFieldsConfig.Defaults
      this.groupSelector = custom.groupSelector ?? ((groups) => Promise.resolve(groups[0].groupId!))
      this.disableParentKeysInitialisation = custom.disableParentKeysInitialisation ?? false
    }

    readonly entryKeysFactory: StorageEntryKeysFactory
    readonly createMaintenanceTasksOnNewKey: boolean
    readonly storage: StorageFacade<string>
    readonly keyStorage: KeyStorageFacade
    readonly headers: { [headerName: string]: string }
    readonly encryptedFieldsConfig: EncryptedFieldsConfig
    readonly groupSelector: (availableGroupsInfo: UserGroup[]) => Promise<string>
    readonly disableParentKeysInitialisation: boolean
  }
}

/**
 * Specifies which fields should be encrypted for each kind of encryptable entity.
 *
 * Note that any value you specify here overrides the default values. For example if you specify `['medicalLocationId']` for `healthElement` the
 * fields `['descr', 'note']` which are usually encrypted by default will no longer be encrypted. If you want to add fields to the default values
 * you can use {@link EncryptedFieldsConfig.Defaults}, for example `[...EncryptedFieldsConfig.Defaults.healthElement, 'medicalLocationId'].
 *
 * # Encrypted fields syntax
 *
 * ## Grammar
 *
 * The grammar for each encrypted field is the following:
 * ```
 * fieldName :=
 *   regex([a-zA-Z_][a-zA-Z0-9_]+)
 * encryptedField :=
 *   fieldName
 *   | fieldName + ("." | ".*." | "[].") + encryptedField
 * ```
 *
 * This grammar allows you to specify the fields to encrypt for the object and recursively for nested objects.
 * - A string containing only a single `fieldName` will encrypt the field with the given name.
 * - A string starting with `fieldName.` allows to specify the encrypted fields of a nested object. The encrypted values of the
 *   fields in the nested object will be saved in the nested object.
 * - A string starting with `fieldName.*.` treats `fieldName` as a map/dictionary data structure and allows to specify the encrypted fields of the
 *   values of the map. Note that the values of the map must be objects as well. The encrypted content of each map value is stored in that value.
 * - A string starting with `fieldName[].` treats `fieldName` as an array and allows to specify the encrypted fields of the values of the array.
 *   Note that the values of the array must be objects as well. The encrypted content of each array element is stored in that element.
 *
 * ## Example
 *
 * Consider the following object and encryption keys:
 * ```javascript
 * const obj = {
 *   a: { x: 0, y: 1 },
 *   b: "hello",
 *   c: [ { public: "a", secret: "b" }, { public: "c", secret: "d" } ],
 *   d: "ok",
 *   e: {
 *     info: "something",
 *     private: "secret",
 *     dataMap: {
 *       "en": {
 *         a: 1,
 *         b: 2
 *       },
 *       "fr": {
 *         a: 3,
 *         b: 4
 *       }
 *     }
 *   }
 * }
 * const encryptedFields = [
 *   "a",
 *   "c[].secret",
 *   "d",
 *   "e.private",
 *   "e.datamap.*.a"
 * ]
 * ```
 * If you use them with the crypt method you will get the following result:
 * ```json
 * {
 *   b: "hello",
 *   c: [
 *     { public: "a", encryptedSelf: 'encrypted+encoded { secret: "b" }' },
 *     { public: "c", encryptedSelf: 'encrypted+encoded { secret: "d" }' }
 *   ],
 *   e: {
 *     info: "something",
 *     dataMap: {
 *       "en": { b: 2, encryptedSelf: 'encrypted+encoded { a: 1 }' },
 *       "fr": { b: 4, encryptedSelf: 'encrypted+encoded { a: 3 }' }
 *     },
 *     encryptedSelf: 'encrypted+encoded { private: "secret" }'
 *   },
 *   encryptedSelf: 'encrypted+encoded { a: { x: 0, y: 1 }, d: "ok" }'
 * }
 * ```
 *
 * ## Shortened representation
 *
 * You can also group encrypted fields having the same prefix by concatenating to the prefix the JSON representation of an array of all the postfixes.
 * For example the following encrypted fields:
 * ```javascript
 * const encryptedFields = ["a.b.c.d.e.f1", "a.b.c.d.e.f2", "a.b.c.d.e.f3", "a.b.c.d.e.f4"]
 * ```
 * can be shortened to
 * ```javascript
 * const encryptedFields = ['a.b.c.d.e.["f1","f2","f3","f4"]'] // Note the use of single quotes to avoid escaping the double quotes
 * ```
 * If you use the shortened representation you may need to escape nested json representations. In that case the use of `JSON.stringify` is
 * recommended.
 */
export interface EncryptedFieldsConfig {
  /**
   * Fields to encrypt for entities of type {@link AccessLog}
   * @default ['detail', 'objectId']
   */
  readonly accessLog?: string[]
  /**
   * Fields to encrypt for entities of type {@link CalendarItem}
   * @default ['details', 'title', 'patientId']
   */
  readonly calendarItem?: string[]
  /**
   * Fields to encrypt for entities of type {@link Contact}, excluding `services`. You can specify which fields of `services` should be encrypted
   * using {@link service}.
   * @default ['descr'] // encryption of `services` is managed through {@link service}
   */
  readonly contact?: string[]
  /**
   * Fields to encrypt for entities of type {@link Service}. Note that encryption of the `content` field and recursively contained `Services` through
   * `content.compoundValue` is automatically managed by the sdk, and you are not allowed to modify it.
   *
   * Note: any non-empty values for this field will break bi-directional data compatibility between v7 and previous: Contacts created with
   * v7 will not be read properly by previous versions. If you want
   * @default ['notes[].markdown'] // encryption of `content` is managed in a special way
   */
  readonly service?: string[]
  /**
   * Fields to encrypt for entities of type {@link HealthElement}
   * @default ['descr', 'note', 'notes[].markdown']
   */
  readonly healthElement?: string[]
  /**
   * Fields to encrypt for entities of type {@link MaintenanceTask}
   * @default ['properties']
   */
  readonly maintenanceTask?: string[]
  /**
   * Fields to encrypt for entities of type {@link Patient}
   * @default ['note', 'notes[].markdown']
   */
  readonly patient?: string[]
}
export namespace EncryptedFieldsConfig {
  export const Defaults = {
    accessLog: ['detail', 'objectId'],
    calendarItem: ['details', 'title', 'patientId'],
    contact: ['descr'],
    service: ['notes[].markdown'],
    healthElement: ['descr', 'note', 'notes[].markdown'],
    maintenanceTask: ['properties'],
    patient: ['note', 'notes[].markdown'],
  }
}

/**
 * Details for the authentication of a user
 */
export type AuthenticationDetails =
  | {
      username: string
      password: string
      thirdPartyTokens?: { [thirdParty: string]: string }
    }
  | {
      icureTokens: { token: string; refreshToken: string }
    }
  | {
      thirdPartyTokens: { [thirdParty: string]: string }
    }
  | SmartAuthenticationDetails

/**
 * Allows to perform authentication through an {@link AuthSecretProvider}.
 *
 * The iCure SDK can authenticate to the backend using different kinds of secrets, such as passwords, long-lived authentication tokens, and
 * short-lived authentication tokens generated through the message gateway. iCure associates to each kind of secret a certain security level, and for
 * some sensitive operations, depending on the configurations of the user and his group, some operations may require a secret of a certain security
 * level. For example, with the default configurations, in order to change his own email the user can't have logged in with a long-lived token, but he
 * needs to provide his current password or a short-lived token.
 *
 * By using this authentication option, the iCure SDK will automatically request and cache the secret from the {@link AuthSecretProvider} only when
 * needed, which should help to minimise the interaction with the user.
 *
 * Another advantage of using this authentication option over others is that in case all the cached tokens and secrets were to expire while performing
 * a request, instead of having the request fail the SDK will ask for a new secret from the {@link SmartAuthProvider} and the request will
 * automatically be retried with the new secret.
 *
 * You must provide the following information:
 * - username: any kind of value that can identify the user (userId, groupId/userId, username, email, ...). More generic identifiers, valid
 *   on multiple groups, allow for simpler group switching by using {@link IcureApi.switchGroup}.
 * - secretProvider: the secret provider to use for authentication. Will handle interaction with the gui.
 *
 * You can also provide the following optional information, which may allow to reduce the requests for secrets initially:
 * - initialSecret: an initial secret (password, token, ...) that will be used to get new authentication tokens as needed. If it is expired it will be ignored.
 * - initialAuthToken: an initial authentication token used on each request. If it is expired it will be ignored.
 * - initialRefreshToken: an initial refresh token used to get new authentication tokens as needed. If it is expired it will be ignored.
 */
export type SmartAuthenticationDetails = {
  username: string
  secretProvider: AuthSecretProvider
  initialSecret?: string
  initialAuthToken?: string
  initialRefreshToken?: string
}

/**
 * Main entry point for the iCure API. Provides entity-specific sub-apis and some general methods which are not related to a specific entity.
 */
export interface IcureApi extends Apis {
  /**
   * Get the information on groups that the current user can access and the current group that this api instance is working on.
   * Note that the values you will get for `availableGroups` may differ from the values you would get if you call {@link IccUserApi.getMatchingUsers}
   * on {@link Apis.userApi}, since the latter is specialised on the specific instance of the user in `currentGroup`.
   */
  getGroupsInfo(): Promise<{ currentGroup: UserGroup; availableGroups: UserGroup[] }>

  /**
   * Switches the api to allow the user to work on a different group.
   * @param newGroupId the id of the group to switch to.
   * @return a new api for the specified group.
   */
  switchGroup(newGroupId: string): Promise<IcureApi>
}

async function getAuthenticationProvider(
  host: string,
  authenticationOptions: AuthenticationDetails | AuthenticationProvider,
  headers: { [headerName: string]: string },
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
) {
  let authenticationProvider: AuthenticationProvider
  if ('getIcureTokens' in authenticationOptions && 'switchGroup' in authenticationOptions && 'getAuthService' in authenticationOptions) {
    authenticationProvider = authenticationOptions
  } else if ('icureTokens' in authenticationOptions && !!authenticationOptions.icureTokens) {
    authenticationProvider = new JwtAuthenticationProvider(
      new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl),
      undefined,
      undefined,
      undefined,
      authenticationOptions.icureTokens
    )
  } else if (
    'username' in authenticationOptions &&
    'password' in authenticationOptions &&
    !!authenticationOptions.username &&
    !!authenticationOptions.password
  ) {
    authenticationProvider = new EnsembleAuthenticationProvider(
      new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl),
      authenticationOptions.username,
      authenticationOptions.password,
      3600,
      undefined,
      undefined,
      authenticationOptions.thirdPartyTokens
    )
  } else if ('thirdPartyTokens' in authenticationOptions && !!authenticationOptions.thirdPartyTokens) {
    authenticationProvider = new JwtAuthenticationProvider(
      new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl),
      undefined,
      undefined,
      new JwtBridgedAuthService(
        new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl),
        undefined,
        undefined,
        authenticationOptions.thirdPartyTokens
      )
    )
  } else if ('username' in authenticationOptions && 'secretProvider' in authenticationOptions) {
    authenticationProvider = SmartAuthProvider.initialise(
      new IccAuthApi(host, headers, new NoAuthenticationProvider(), fetchImpl),
      authenticationOptions.username,
      authenticationOptions.secretProvider,
      {
        initialSecret: authenticationOptions.initialSecret,
        initialAuthToken: authenticationOptions.initialAuthToken,
        initialRefreshToken: authenticationOptions.initialRefreshToken,
      }
    )
  } else {
    throw new Error('Invalid authentication options provided')
  }
  return authenticationProvider
}

/**
 * Main entry point for the iCure API. Provides entity-specific sub-apis and some general methods which are not related to a specific entity.
 */
export interface IcureApi extends Apis {
  /**
   * Get the information on groups that the current user can access and the current group that this api instance is working on.
   * Note that the values you will get for `availableGroups` may differ from the values you would get if you call {@link IccUserApi.getMatchingUsers}
   * on {@link Apis.userApi}, since the latter is specialised on the specific instance of the user in `currentGroup`.
   */
  getGroupsInfo(): Promise<{ currentGroup: UserGroup; availableGroups: UserGroup[] }>

  /**
   * Switches the api to allow the user to work on a different group.
   * @param newGroupId the id of the group to switch to.
   * @return a new api for the specified group.
   */
  switchGroup(newGroupId: string): Promise<IcureApi>
}
export namespace IcureApi {
  /**
   * Initialises a new instance of the iCure API.
   */
  export async function initialise(
    host: string,
    authenticationOptions: AuthenticationDetails | AuthenticationProvider,
    cryptoStrategies: CryptoStrategies,
    crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch,
    options: IcureApiOptions = {}
  ): Promise<IcureApi> {
    const params = new IcureApiOptions.WithDefaults(options)

    let grouplessAuthenticationProvider = await getAuthenticationProvider(host, authenticationOptions, params.headers ?? {}, fetchImpl)
    const grouplessUserApi = new IccUserApi(host, params.headers, grouplessAuthenticationProvider, fetchImpl)
    const matches = await grouplessUserApi.getMatchingUsers()
    const chosenGroupId = matches.length > 1 ? await params.groupSelector(matches) : matches[0].groupId!
    /*TODO
     * On new very new users switching the authentication provider to a specific group may fail and block the user for too many requests. This is
     * probably linked to replication of the user in the fallback database.
     */
    const groupSpecificAuthenticationProvider =
      matches.length > 1 ? await grouplessAuthenticationProvider.switchGroup(chosenGroupId, matches) : grouplessAuthenticationProvider
    const cryptoApis = await initialiseCryptoWithProvider(host, fetchImpl, groupSpecificAuthenticationProvider, params, cryptoStrategies, crypto)
    return new IcureApiImpl(
      cryptoApis,
      host,
      groupSpecificAuthenticationProvider,
      fetch,
      grouplessUserApi,
      matches,
      matches.find((match) => match.groupId === chosenGroupId)!,
      params,
      cryptoStrategies
    )
  }
}

// Apis which are used during crypto api initialisation, to avoid re-instantiating them later
type CryptoInitialisationApis = {
  cryptoApi: IccCryptoXApi
  healthcarePartyApi: IccHcpartyXApi
  deviceApi: IccDeviceXApi
  // no patient api since it is base
  dataOwnerApi: IccDataOwnerXApi
  userApi: IccUserXApi
  icureMaintenanceTaskApi: IccIcureMaintenanceXApi
  maintenanceTaskApi: IccMaintenanceTaskXApi
}

async function initialiseCryptoWithProvider(
  host: string,
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  groupSpecificAuthenticationProvider: AuthenticationProvider,
  params: IcureApiOptions.WithDefaults,
  cryptoStrategies: CryptoStrategies,
  crypto: Crypto
): Promise<CryptoInitialisationApis> {
  const authApi = new IccAuthApi(host, params.headers, groupSpecificAuthenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, params.headers, groupSpecificAuthenticationProvider, authApi, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, params.headers, groupSpecificAuthenticationProvider, authApi, fetchImpl)
  const deviceApi = new IccDeviceXApi(host, params.headers, groupSpecificAuthenticationProvider, userApi, authApi, fetchImpl)
  const basePatientApi = new IccPatientApi(host, params.headers, groupSpecificAuthenticationProvider, fetchImpl)
  const dataOwnerApi = new IccDataOwnerXApi(host, params.headers, groupSpecificAuthenticationProvider, fetchImpl)
  // Crypto initialisation
  const icureStorage = new IcureStorageFacade(params.keyStorage, params.storage, params.entryKeysFactory)
  const cryptoPrimitives = new CryptoPrimitives(crypto)
  const baseExchangeKeysManager = new BaseExchangeKeysManager(cryptoPrimitives, dataOwnerApi, healthcarePartyApi, basePatientApi, deviceApi)
  const keyRecovery = new KeyRecovery(cryptoPrimitives, baseExchangeKeysManager, dataOwnerApi)
  const keyManager = new KeyManager(
    cryptoPrimitives,
    dataOwnerApi,
    icureStorage,
    keyRecovery,
    baseExchangeKeysManager,
    cryptoStrategies,
    !params.disableParentKeysInitialisation
  )
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
    !params.disableParentKeysInitialisation
  )
  const entitiesEncryption = new EntitiesEncryption(cryptoPrimitives, dataOwnerApi, exchangeKeysManager, !params.disableParentKeysInitialisation)
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
    confidentialEntitites,
    basePatientApi
  )
  const maintenanceTaskApi = new IccMaintenanceTaskXApi(
    host,
    params.headers,
    cryptoApi,
    healthcarePartyApi,
    dataOwnerApi,
    userApi,
    authApi,
    params.encryptedFieldsConfig?.maintenanceTask ?? EncryptedFieldsConfig.Defaults.maintenanceTask,
    groupSpecificAuthenticationProvider,
    fetchImpl
  )
  const icureMaintenanceTaskApi = new IccIcureMaintenanceXApi(cryptoApi, maintenanceTaskApi, dataOwnerApi)
  if (newKey && params.createMaintenanceTasksOnNewKey) {
    await icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(await userApi.getCurrentUser(), newKey.newKeyPair)
  }
  return {
    cryptoApi,
    healthcarePartyApi,
    deviceApi,
    dataOwnerApi,
    userApi,
    icureMaintenanceTaskApi,
    maintenanceTaskApi,
  }
}

class IcureApiImpl implements IcureApi {
  private latestGroupsRequest: Promise<UserGroup[]>
  private _authApi: IccAuthApi | undefined
  private _codeApi: IccCodeXApi | undefined
  private _calendarItemTypeApi: IccCalendarItemTypeApi | undefined
  private _medicalLocationApi: IccMedicallocationApi | undefined
  private _entityReferenceApi: IccEntityrefApi | undefined
  private _permissionApi: IccPermissionApi | undefined
  private _accessLogApi: IccAccesslogXApi | undefined
  private _agendaApi: IccAgendaApi | undefined
  private _contactApi: IccContactXApi | undefined
  private _formApi: IccFormXApi | undefined
  private _groupApi: IccGroupApi | undefined
  private _invoiceApi: IccInvoiceXApi | undefined
  private _insuranceApi: IccInsuranceApi | undefined
  private _documentApi: IccDocumentXApi | undefined
  private _healthcareElementApi: IccHelementXApi | undefined
  private _classificationApi: IccClassificationXApi | undefined
  private _calendarItemApi: IccCalendarItemXApi | undefined
  private _receiptApi: IccReceiptXApi | undefined
  private _timetableApi: IccTimeTableXApi | undefined
  private _patientApi: IccPatientXApi | undefined
  private _messageApi: IccMessageXApi | undefined
  private _anonymousAccessApi: IccAnonymousAccessApi | undefined
  private _applicationSettingsApi: IccApplicationsettingsApi | undefined
  private _articleApi: IccArticleApi | undefined
  private _bekmehrApi: IccBekmehrXApi | undefined
  private _beefactApi: IccBeefactApi | undefined
  private _beresultexportApi: IccBeresultexportApi | undefined
  private _beresultimportApi: IccBeresultimportApi | undefined
  private _besamv2Api: IccBesamv2Api | undefined
  private _classificationTemplateApi: IccClassificationTemplateApi | undefined
  private _doctemplateApi: IccDoctemplateXApi | undefined
  private _entitytemplateApi: IccEntitytemplateApi | undefined
  private _frontendmigrationApi: IccFrontendmigrationApi | undefined
  private _icureApi: IccIcureApi | undefined
  private _keywordApi: IccKeywordApi | undefined
  private _medexApi: IccMedexApi | undefined
  private _placeApi: IccPlaceApi | undefined
  private _pubsubApi: IccPubsubApi | undefined
  private _replicationApi: IccReplicationApi | undefined
  private _tarificationApi: IccTarificationApi | undefined
  private _tmpApi: IccTmpApi | undefined
  private _roleApi: IccRoleApi | undefined

  get cryptoApi(): IccCryptoXApi {
    return this.cryptoInitApis.cryptoApi
  }

  get dataOwnerApi(): IccDataOwnerXApi {
    return this.cryptoInitApis.dataOwnerApi
  }

  get accessLogApi(): IccAccesslogXApi {
    return (
      this._accessLogApi ??
      (this._accessLogApi = new IccAccesslogXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.params.encryptedFieldsConfig.accessLog ?? EncryptedFieldsConfig.Defaults.accessLog,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get agendaApi(): IccAgendaApi {
    return (
      this._agendaApi ?? (this._agendaApi = new IccAgendaApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  get roleApi(): IccRoleApi {
    return this._roleApi ?? (this._roleApi = new IccRoleApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }

  get anonymousAccessApi(): IccAnonymousAccessApi {
    return (
      this._anonymousAccessApi ??
      (this._anonymousAccessApi = new IccAnonymousAccessApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get applicationSettingsApi(): IccApplicationsettingsApi {
    return (
      this._applicationSettingsApi ??
      (this._applicationSettingsApi = new IccApplicationsettingsApi(
        this.host,
        this.params.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get articleApi(): IccArticleApi {
    return (
      this._articleApi ?? (this._articleApi = new IccArticleApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get authApi(): IccAuthApi {
    return this._authApi ?? (this._authApi = new IccAuthApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get beefactApi(): IccBeefactApi {
    return (
      this._beefactApi ?? (this._beefactApi = new IccBeefactApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get bekmehrApi(): IccBekmehrXApi {
    return (
      this._bekmehrApi ??
      (this._bekmehrApi = new IccBekmehrXApi(
        this.host,
        this.params.headers,
        this.authApi,
        this.contactApi,
        this.healthcareElementApi,
        this.documentApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get beresultexportApi(): IccBeresultexportApi {
    return (
      this._beresultexportApi ??
      (this._beresultexportApi = new IccBeresultexportApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get beresultimportApi(): IccBeresultimportApi {
    return (
      this._beresultimportApi ??
      (this._beresultimportApi = new IccBeresultimportApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get besamv2Api(): IccBesamv2Api {
    return (
      this._besamv2Api ?? (this._besamv2Api = new IccBesamv2Api(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get calendarItemApi(): IccCalendarItemXApi {
    return (
      this._calendarItemApi ??
      (this._calendarItemApi = new IccCalendarItemXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.params.encryptedFieldsConfig.calendarItem ?? EncryptedFieldsConfig.Defaults.calendarItem,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get calendarItemTypeApi(): IccCalendarItemTypeApi {
    return (
      this._calendarItemTypeApi ??
      (this._calendarItemTypeApi = new IccCalendarItemTypeApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get classificationApi(): IccClassificationXApi {
    return (
      this._classificationApi ??
      (this._classificationApi = new IccClassificationXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get classificationTemplateApi(): IccClassificationTemplateApi {
    return (
      this._classificationTemplateApi ??
      (this._classificationTemplateApi = new IccClassificationTemplateApi(
        this.host,
        this.params.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get codeApi(): IccCodeXApi {
    return this._codeApi ?? (this._codeApi = new IccCodeXApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get contactApi(): IccContactXApi {
    return (
      this._contactApi ??
      (this._contactApi = new IccContactXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.userApi,
        this.authApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch,
        this.params.encryptedFieldsConfig.contact ?? EncryptedFieldsConfig.Defaults.contact,
        this.params.encryptedFieldsConfig.service ?? EncryptedFieldsConfig.Defaults.service
      ))
    )
  }
  get deviceApi(): IccDeviceXApi {
    return this.cryptoInitApis.deviceApi
  }
  get doctemplateApi(): IccDoctemplateXApi {
    return (
      this._doctemplateApi ??
      (this._doctemplateApi = new IccDoctemplateXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get documentApi(): IccDocumentXApi {
    return (
      this._documentApi ??
      (this._documentApi = new IccDocumentXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.authApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get entityReferenceApi(): IccEntityrefApi {
    return (
      this._entityReferenceApi ??
      (this._entityReferenceApi = new IccEntityrefApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get entitytemplateApi(): IccEntitytemplateApi {
    return (
      this._entitytemplateApi ??
      (this._entitytemplateApi = new IccEntitytemplateApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get formApi(): IccFormXApi {
    return (
      this._formApi ??
      (this._formApi = new IccFormXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get frontendmigrationApi(): IccFrontendmigrationApi {
    return (
      this._frontendmigrationApi ??
      (this._frontendmigrationApi = new IccFrontendmigrationApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get groupApi(): IccGroupApi {
    return this._groupApi ?? (this._groupApi = new IccGroupApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get healthcareElementApi(): IccHelementXApi {
    return (
      this._healthcareElementApi ??
      (this._healthcareElementApi = new IccHelementXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.userApi,
        this.authApi,
        this.params.encryptedFieldsConfig.healthElement ?? EncryptedFieldsConfig.Defaults.healthElement,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get healthcarePartyApi(): IccHcpartyXApi {
    return this.cryptoInitApis.healthcarePartyApi
  }
  get icureApi(): IccIcureApi {
    return this._icureApi ?? (this._icureApi = new IccIcureApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get icureMaintenanceTaskApi(): IccIcureMaintenanceXApi {
    return this.cryptoInitApis.icureMaintenanceTaskApi
  }
  get insuranceApi(): IccInsuranceApi {
    return (
      this._insuranceApi ??
      (this._insuranceApi = new IccInsuranceApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get invoiceApi(): IccInvoiceXApi {
    return (
      this._invoiceApi ??
      (this._invoiceApi = new IccInvoiceXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.entityReferenceApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get keywordApi(): IccKeywordApi {
    return (
      this._keywordApi ?? (this._keywordApi = new IccKeywordApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get maintenanceTaskApi(): IccMaintenanceTaskXApi {
    return this.cryptoInitApis.maintenanceTaskApi
  }
  get medexApi(): IccMedexApi {
    return this._medexApi ?? (this._medexApi = new IccMedexApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get medicalLocationApi(): IccMedicallocationApi {
    return (
      this._medicalLocationApi ??
      (this._medicalLocationApi = new IccMedicallocationApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get messageApi(): IccMessageXApi {
    return (
      this._messageApi ??
      (this._messageApi = new IccMessageXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get patientApi(): IccPatientXApi {
    return (
      this._patientApi ??
      (this._patientApi = new IccPatientXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.contactApi,
        this.formApi,
        this.healthcareElementApi,
        this.invoiceApi,
        this.documentApi,
        this.healthcarePartyApi,
        this.classificationApi,
        this.dataOwnerApi,
        this.calendarItemApi,
        this.userApi,
        this.authApi,
        this.params.encryptedFieldsConfig.patient ?? EncryptedFieldsConfig.Defaults.patient,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get permissionApi(): IccPermissionApi {
    return (
      this._permissionApi ??
      (this._permissionApi = new IccPermissionApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get placeApi(): IccPlaceApi {
    return this._placeApi ?? (this._placeApi = new IccPlaceApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get pubsubApi(): IccPubsubApi {
    return (
      this._pubsubApi ?? (this._pubsubApi = new IccPubsubApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get receiptApi(): IccReceiptXApi {
    return (
      this._receiptApi ??
      (this._receiptApi = new IccReceiptXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get replicationApi(): IccReplicationApi {
    return (
      this._replicationApi ??
      (this._replicationApi = new IccReplicationApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get tarificationApi(): IccTarificationApi {
    return (
      this._tarificationApi ??
      (this._tarificationApi = new IccTarificationApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get timetableApi(): IccTimeTableXApi {
    return (
      this._timetableApi ??
      (this._timetableApi = new IccTimeTableXApi(
        this.host,
        this.params.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }
  get tmpApi(): IccTmpApi {
    return this._tmpApi ?? (this._tmpApi = new IccTmpApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get userApi(): IccUserXApi {
    return this.cryptoInitApis.userApi
  }

  constructor(
    private readonly cryptoInitApis: CryptoInitialisationApis,
    private readonly host: string,
    private readonly groupSpecificAuthenticationProvider: AuthenticationProvider,
    private readonly fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    private readonly grouplessUserApi: IccUserApi,
    private readonly latestMatches: UserGroup[],
    private readonly currentGroupInfo: UserGroup,
    private readonly params: IcureApiOptions.WithDefaults,
    private readonly cryptoStrategies: CryptoStrategies
  ) {
    this.latestGroupsRequest = Promise.resolve(latestMatches)
  }

  async getGroupsInfo(): Promise<{ currentGroup: UserGroup; availableGroups: UserGroup[] }> {
    this.latestGroupsRequest = this.grouplessUserApi.getMatchingUsers()
    return { currentGroup: this.currentGroupInfo, availableGroups: await this.latestGroupsRequest }
  }

  async switchGroup(newGroupId: string): Promise<IcureApi> {
    const availableGroups = await this.latestGroupsRequest
    const switchedProvider = await this.groupSpecificAuthenticationProvider.switchGroup(newGroupId, availableGroups)
    const cryptoInitApis = await initialiseCryptoWithProvider(
      this.host,
      this.fetch,
      switchedProvider,
      this.params,
      this.cryptoStrategies,
      this.cryptoApi.primitives.crypto
    )
    return new IcureApiImpl(
      cryptoInitApis,
      this.host,
      switchedProvider,
      this.fetch,
      this.grouplessUserApi,
      availableGroups,
      availableGroups.find((x) => x.groupId === newGroupId)!,
      this.params,
      this.cryptoStrategies
    )
  }
}

/**
 * @experimental This function still needs development and will be changed
 * Build apis which do not need crypto and can be used by non-data-owner users
 */
export const BasicApis = async function (
  host: string,
  authenticationOptions: AuthenticationDetails | AuthenticationProvider,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
    ? window.fetch
    : typeof self !== 'undefined'
    ? self.fetch
    : fetch,
  options: { headers?: { [headerName: string]: string } } = {}
): Promise<BasicApis> {
  const authenticationProvider = await getAuthenticationProvider(host, authenticationOptions, options.headers ?? {}, fetchImpl)
  const authApi = new IccAuthApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)

  const codeApi = new IccCodeXApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)
  const entityReferenceApi = new IccEntityrefApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, options.headers ?? {}, authenticationProvider, authApi, fetchImpl)
  const deviceApi = new IccDeviceXApi(host, options.headers ?? {}, authenticationProvider, userApi, authApi, fetchImpl)
  const permissionApi = new IccPermissionApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)
  const agendaApi = new IccAgendaApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)
  const groupApi = new IccGroupApi(host, options.headers ?? {}, authenticationProvider)
  const insuranceApi = new IccInsuranceApi(host, options.headers ?? {}, authenticationProvider, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, options.headers ?? {}, authenticationProvider, authApi, fetchImpl)

  return {
    authApi,
    deviceApi,
    codeApi,
    userApi,
    permissionApi,
    insuranceApi,
    entityReferenceApi,
    agendaApi,
    groupApi,
    healthcarePartyApi,
  }
}
