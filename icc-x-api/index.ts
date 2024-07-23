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
import { CryptoPrimitives, WebCryptoPrimitives } from './crypto/CryptoPrimitives'
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
import { ConfidentialEntities } from './crypto/ConfidentialEntities'
import { ensureDelegationForSelf } from './crypto/utils'
import { SecureDelegationsSecurityMetadataDecryptor } from './crypto/SecureDelegationsSecurityMetadataDecryptor'
import { initialiseExchangeDataManagerForCurrentDataOwner } from './crypto/ExchangeDataManager'
import { BaseExchangeDataManager } from './crypto/BaseExchangeDataManager'
import { IccExchangeDataApi } from '../icc-api/api/internal/IccExchangeDataApi'
import { UserSignatureKeysManager } from './crypto/UserSignatureKeysManager'
import { AccessControlSecretUtils } from './crypto/AccessControlSecretUtils'
import { SecureDelegationsEncryption } from './crypto/SecureDelegationsEncryption'
import { LegacyDelegationSecurityMetadataDecryptor } from './crypto/LegacyDelegationSecurityMetadataDecryptor'
import { ExtendedApisUtilsImpl } from './crypto/ExtendedApisUtilsImpl'
import { SecureDelegationsManager } from './crypto/SecureDelegationsManager'
import { AccessControlKeysHeadersProvider } from './crypto/AccessControlKeysHeadersProvider'
import { IccExchangeDataMapApi } from '../icc-api/api/internal/IccExchangeDataMapApi'
import { ExchangeDataMapManager } from './crypto/ExchangeDataMapManager'
import { IccDeviceXApi } from './icc-device-x-api'
import { IccBekmehrXApi } from './icc-bekmehr-x-api'
import { IccDoctemplateXApi } from './icc-doctemplate-x-api'
import { UserGroup } from '../icc-api/model/UserGroup'
import { IccTopicXApi } from './icc-topic-x-api'
import { IccRoleApi } from '../icc-api/api/IccRoleApi'
import { DataOwnerTypeEnum } from '../icc-api/model/DataOwnerTypeEnum'
import { DelegationsDeAnonymization } from './crypto/DelegationsDeAnonymization'
import { JwtBridgedAuthService } from './auth/JwtBridgedAuthService'
import { AuthSecretProvider, SmartAuthProvider } from './auth/SmartAuthProvider'
import { KeyPairRecoverer } from './crypto/KeyPairRecoverer'
import { IccRecoveryDataApi } from '../icc-api/api/internal/IccRecoveryDataApi'
import { RecoveryDataEncryption } from './crypto/RecoveryDataEncryption'
import { IccRecoveryXApi } from './icc-recovery-x-api'
import { getGroupOfJwt } from './auth/JwtUtils'

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
export * from './icc-recovery-x-api'
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
export { NativeCryptoPrimitivesBridge } from './crypto/NativeCryptoPrimitivesBridge'
export { getShaVersionForKey } from './crypto/utils'

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
  readonly patientApi: IccPatientApi
  readonly roleApi: IccRoleApi
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
  readonly topicApi: IccTopicXApi
  readonly recoveryApi: IccRecoveryXApi
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
   * Specifies if iCure should automatically create maintenance tasks for requesting access back when a new key is generated at initialisation time.
   * Note that the maintenance task will be created only towards HCP data owners: if you want to create a maintenance task also to other types of data
   * owners you should disable this and call {@link IccIcureMaintenanceXApi.createMaintenanceTasksForNewKeypair} yourself.
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
   * the group to use for a given user.
   * This functions will be called only if a user exists in at least 2 groups, and takes in input:
   * - the information on the groups the user can access (in no specific order)
   * - if the authentication method uses JWT also the current group id (undefined otherwise)
   * The function must return the id of one of the available groups.
   * @default takes the first group provided. The group chosen by this method may vary between different instantiations of the {@link IcureApi} even
   * if for the same user and if the groups available for the user do not change.
   */
  readonly groupSelector?: (availableGroupsInfo: UserGroup[], currentGroupId?: string) => Promise<string>
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
    readonly entryKeysFactory: StorageEntryKeysFactory
    readonly createMaintenanceTasksOnNewKey: boolean
    readonly storage: StorageFacade<string>
    readonly keyStorage: KeyStorageFacade
    readonly headers: { [headerName: string]: string }
    readonly encryptedFieldsConfig: EncryptedFieldsConfig
    readonly groupSelector: (availableGroupsInfo: UserGroup[]) => Promise<string>
    readonly disableParentKeysInitialisation: boolean

    constructor(custom: IcureApiOptions) {
      this.entryKeysFactory = custom.entryKeysFactory ?? Defaults.entryKeysFactory
      this.createMaintenanceTasksOnNewKey = custom.createMaintenanceTasksOnNewKey ?? Defaults.createMaintenanceTasksOnNewKey
      this.storage = custom.storage ?? new LocalStorageImpl()
      this.keyStorage = custom.keyStorage ?? new KeyStorageImpl(this.storage)
      this.headers = custom.headers ?? Defaults.headers
      this.encryptedFieldsConfig = custom.encryptedFieldsConfig ?? {}
      this.groupSelector = custom.groupSelector ?? ((groups) => Promise.resolve(groups[0].groupId!))
      this.disableParentKeysInitialisation = custom.disableParentKeysInitialisation ?? false
    }
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

  /**
   * Fields to encrypt for entities of type {@link Message}
   * @default []
   */
  readonly message?: string[]

  /**
   * Fields to encrypt for entities of type {@link Topic}
   * @default ['description']
   */
  readonly topic?: string[]
}

export namespace EncryptedFieldsConfig {
  export const Defaults = {
    accessLog: ['detail', 'objectId'],
    calendarItem: ['details', 'title', 'patientId'],
    contact: ['descr', 'notes[].markdown'],
    service: ['notes[].markdown'],
    healthElement: ['descr', 'note', 'notes[].markdown'],
    maintenanceTask: ['properties'],
    patient: ['note', 'notes[].markdown'],
    message: [],
    topic: ['description', 'linkedServices', 'linkedHealthElements'],
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
      credentials?: { username: string; password: string }
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
  initialSecret?: { plainSecret: string } | { oauthToken: string; oauthType: OAuthThirdParty }
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
   * - `currentGroup`: the group that this api instance is working on, or undefined if the backend environment is not multi-group.
   * - `availableGroups`: the list of groups that the current user can access with the provided secret. Empty if the backend environment is not
   * multi-group.
   */
  getGroupsInfo(): Promise<{ currentGroup: UserGroup | undefined; availableGroups: UserGroup[] }>

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
    crypto: Crypto | CryptoPrimitives = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch,
    options: IcureApiOptions = {}
  ): Promise<IcureApi> {
    const params = new IcureApiOptions.WithDefaults(options)
    let grouplessAuthenticationProvider = await getAuthenticationProvider(host, authenticationOptions, params.headers, fetchImpl)
    // TODO if this uses a smart auth provider the groupless auth provider does not share the secret cache with the group specific one.
    const grouplessUserApi = new IccUserApi(host, params.headers, grouplessAuthenticationProvider, fetchImpl)
    const matches = await getMatchesOrEmpty(grouplessUserApi)
    const tokens = await grouplessAuthenticationProvider.getIcureTokens()
    const currentGroupId = tokens ? getGroupOfJwt(tokens.token) : undefined
    const chosenGroupId = matches.length > 1 && !!options.groupSelector ? await options.groupSelector(matches, currentGroupId) : matches[0]?.groupId
    /*TODO
     * On new very new users switching the authentication provider to a specific group may fail and block the user for too many requests. This is
     * probably linked to replication of the user in the fallback database.
     */
    const groupSpecificAuthenticationProvider =
      matches.length > 1 && chosenGroupId && chosenGroupId !== currentGroupId
        ? await grouplessAuthenticationProvider.switchGroup(chosenGroupId, matches)
        : grouplessAuthenticationProvider
    const cryptoInitInfo = await initialiseCryptoWithProvider(host, fetchImpl, groupSpecificAuthenticationProvider, params, cryptoStrategies, crypto)
    return new IcureApiImpl(
      cryptoInitInfo,
      host,
      groupSpecificAuthenticationProvider,
      fetch,
      grouplessUserApi,
      matches,
      matches.find((match) => match.groupId === chosenGroupId),
      params,
      cryptoStrategies
    )
  }
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
      authenticationOptions?.credentials?.username,
      authenticationOptions?.credentials?.password,
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
        authenticationOptions.thirdPartyTokens,
        undefined
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

// Apis which are used during crypto api initialisation, to avoid re-instantiating them later
type CryptoInitialisationInfo = {
  cryptoApi: IccCryptoXApi
  healthcarePartyApi: IccHcpartyXApi
  deviceApi: IccDeviceXApi
  // no patient api since it is base
  dataOwnerApi: IccDataOwnerXApi
  userApi: IccUserXApi
  icureMaintenanceTaskApi: IccIcureMaintenanceXApi
  maintenanceTaskApi: IccMaintenanceTaskXApi
  headers: { [headerName: string]: string }
  dataOwnerRequiresAnonymousDelegation: boolean
  recoveryApi: IccRecoveryXApi
}

const REQUEST_AUTOFIX_ANONYMITY_HEADER = 'Icure-Request-Autofix-Anonymity'

async function initialiseCryptoWithProvider(
  host: string,
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  groupSpecificAuthenticationProvider: AuthenticationProvider,
  params: IcureApiOptions.WithDefaults,
  cryptoStrategies: CryptoStrategies,
  crypto: Crypto | CryptoPrimitives
): Promise<CryptoInitialisationInfo> {
  const initialDataOwnerStub = await new IccDataOwnerXApi(
    host,
    params.headers,
    groupSpecificAuthenticationProvider,
    fetchImpl
  ).getCurrentDataOwnerStub()
  const dataOwnerRequiresAnonymousDelegation = cryptoStrategies.dataOwnerRequiresAnonymousDelegation(initialDataOwnerStub)
  let updatedHeaders = params.headers
  if (!Object.keys(updatedHeaders).includes(REQUEST_AUTOFIX_ANONYMITY_HEADER)) {
    if (initialDataOwnerStub.type == DataOwnerTypeEnum.Patient || initialDataOwnerStub.type == DataOwnerTypeEnum.Device) {
      if (!dataOwnerRequiresAnonymousDelegation) {
        updatedHeaders = { ...updatedHeaders, [REQUEST_AUTOFIX_ANONYMITY_HEADER]: 'false' }
      }
    } else {
      if (dataOwnerRequiresAnonymousDelegation) {
        updatedHeaders = { ...updatedHeaders, [REQUEST_AUTOFIX_ANONYMITY_HEADER]: 'true' }
      }
    }
  }

  const authApi = new IccAuthApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  const userApi = new IccUserXApi(host, updatedHeaders, groupSpecificAuthenticationProvider, authApi, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, updatedHeaders, groupSpecificAuthenticationProvider, authApi, fetchImpl)
  const deviceApi = new IccDeviceXApi(host, updatedHeaders, groupSpecificAuthenticationProvider, userApi, authApi, fetchImpl)
  const basePatientApi = new IccPatientApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  const dataOwnerApi = new IccDataOwnerXApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  const exchangeDataApi = new IccExchangeDataApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  const baseRecoveryDataApi = new IccRecoveryDataApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  // Crypto initialisation
  const icureStorage = new IcureStorageFacade(params.keyStorage, params.storage, params.entryKeysFactory)
  const cryptoPrimitives = 'AES' in crypto && 'RSA' in crypto && 'HMAC' in crypto ? crypto : new WebCryptoPrimitives(crypto)
  const baseExchangeKeysManager = new BaseExchangeKeysManager(cryptoPrimitives, dataOwnerApi, healthcarePartyApi, basePatientApi, deviceApi)
  const baseExchangeDataManager = new BaseExchangeDataManager(exchangeDataApi, dataOwnerApi, cryptoPrimitives, dataOwnerRequiresAnonymousDelegation)
  const keyRecovery = new KeyRecovery(cryptoPrimitives, dataOwnerApi, baseExchangeKeysManager, baseExchangeDataManager)
  const recoveryDataEncryption = new RecoveryDataEncryption(cryptoPrimitives, baseRecoveryDataApi)
  const keyPairRecoverer = new KeyPairRecoverer(recoveryDataEncryption)
  const userEncryptionKeysManager = new UserEncryptionKeysManager(
    cryptoPrimitives,
    dataOwnerApi,
    icureStorage,
    keyRecovery,
    cryptoStrategies,
    !params.disableParentKeysInitialisation,
    keyPairRecoverer
  )
  const userSignatureKeysManager = new UserSignatureKeysManager(icureStorage, dataOwnerApi, cryptoPrimitives)
  const newKey = await userEncryptionKeysManager.initialiseKeys()
  await new TransferKeysManager(
    cryptoPrimitives,
    baseExchangeDataManager,
    dataOwnerApi,
    userEncryptionKeysManager,
    userSignatureKeysManager,
    icureStorage
  ).updateTransferKeys(await dataOwnerApi.getCurrentDataOwnerStub())
  // TODO customise cache size?
  const exchangeKeysManager = new ExchangeKeysManager(
    100,
    500,
    600000,
    60000,
    cryptoStrategies,
    cryptoPrimitives,
    userEncryptionKeysManager,
    baseExchangeKeysManager,
    dataOwnerApi,
    !params.disableParentKeysInitialisation,
    icureStorage
  )
  const accessControlSecretUtils = new AccessControlSecretUtils(cryptoPrimitives)
  const exchangeDataManager = await initialiseExchangeDataManagerForCurrentDataOwner(
    baseExchangeDataManager,
    userEncryptionKeysManager,
    userSignatureKeysManager,
    accessControlSecretUtils,
    cryptoStrategies,
    dataOwnerApi,
    cryptoPrimitives,
    !params.disableParentKeysInitialisation
  )
  const exchangeDataMapManager = new ExchangeDataMapManager(
    new IccExchangeDataMapApi(host, updatedHeaders, groupSpecificAuthenticationProvider, fetchImpl)
  )
  const secureDelegationsEncryption = new SecureDelegationsEncryption(userEncryptionKeysManager, cryptoPrimitives)
  const secureDelegationsSecurityMetadataEncryption = new SecureDelegationsSecurityMetadataDecryptor(
    exchangeDataManager,
    exchangeDataMapManager,
    secureDelegationsEncryption,
    dataOwnerApi
  )
  const xApiUtils = new ExtendedApisUtilsImpl(
    cryptoPrimitives,
    dataOwnerApi,
    new LegacyDelegationSecurityMetadataDecryptor(exchangeKeysManager, cryptoPrimitives),
    secureDelegationsSecurityMetadataEncryption,
    new SecureDelegationsManager(
      exchangeDataManager,
      exchangeDataMapManager,
      secureDelegationsEncryption,
      accessControlSecretUtils,
      userEncryptionKeysManager,
      cryptoPrimitives,
      dataOwnerApi,
      cryptoStrategies,
      dataOwnerRequiresAnonymousDelegation
    ),
    userApi,
    !params.disableParentKeysInitialisation
  )
  const shamirManager = new ShamirKeysManager(cryptoPrimitives, dataOwnerApi, userEncryptionKeysManager, exchangeDataManager)
  const confidentialEntitites = new ConfidentialEntities(xApiUtils, cryptoPrimitives, dataOwnerApi)
  await ensureDelegationForSelf(dataOwnerApi, xApiUtils, basePatientApi, cryptoPrimitives)
  const accessControlKeysHeadersProvider = new AccessControlKeysHeadersProvider(exchangeDataManager)
  const delegationsDeAnonymisation = new DelegationsDeAnonymization(
    dataOwnerApi,
    secureDelegationsSecurityMetadataEncryption,
    xApiUtils,
    cryptoPrimitives,
    accessControlSecretUtils,
    host,
    updatedHeaders,
    groupSpecificAuthenticationProvider,
    fetchImpl,
    accessControlKeysHeadersProvider
  )
  const cryptoApi = new IccCryptoXApi(
    exchangeKeysManager,
    cryptoPrimitives,
    userEncryptionKeysManager,
    dataOwnerApi,
    xApiUtils,
    shamirManager,
    params.storage,
    params.keyStorage,
    confidentialEntitites,
    exchangeDataManager,
    accessControlKeysHeadersProvider,
    delegationsDeAnonymisation
  )
  const maintenanceTaskApi = new IccMaintenanceTaskXApi(
    host,
    updatedHeaders,
    cryptoApi,
    healthcarePartyApi,
    dataOwnerApi,
    userApi,
    authApi,
    !dataOwnerRequiresAnonymousDelegation,
    params.encryptedFieldsConfig.maintenanceTask ?? EncryptedFieldsConfig.Defaults.maintenanceTask,
    groupSpecificAuthenticationProvider,
    fetchImpl
  )
  const icureMaintenanceTaskApi = new IccIcureMaintenanceXApi(cryptoApi, maintenanceTaskApi, dataOwnerApi, exchangeDataApi)

  if (newKey && params.createMaintenanceTasksOnNewKey) {
    await icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(await userApi.getCurrentUser(), newKey.newKeyPair)
  }
  return {
    cryptoApi,
    userApi,
    healthcarePartyApi,
    deviceApi,
    maintenanceTaskApi,
    dataOwnerApi,
    icureMaintenanceTaskApi,
    headers: updatedHeaders,
    dataOwnerRequiresAnonymousDelegation,
    recoveryApi: new IccRecoveryXApi(
      baseRecoveryDataApi,
      recoveryDataEncryption,
      userEncryptionKeysManager,
      dataOwnerApi,
      cryptoPrimitives,
      exchangeDataManager
    ),
  }
}

class IcureApiImpl implements IcureApi {
  private latestGroupsRequest: Promise<UserGroup[]>

  constructor(
    private readonly cryptoInitInfos: CryptoInitialisationInfo,
    private readonly host: string,
    private readonly groupSpecificAuthenticationProvider: AuthenticationProvider,
    private readonly fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    private readonly grouplessUserApi: IccUserApi,
    latestMatches: UserGroup[],
    private readonly currentGroupInfo: UserGroup | undefined,
    private readonly params: IcureApiOptions.WithDefaults,
    private readonly cryptoStrategies: CryptoStrategies
  ) {
    this.latestGroupsRequest = Promise.resolve(latestMatches)
  }

  private _authApi: IccAuthApi | undefined

  get recoveryApi(): IccRecoveryXApi {
    return this.cryptoInitInfos.recoveryApi
  }

  get authApi(): IccAuthApi {
    return (
      this._authApi ?? (this._authApi = new IccAuthApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _codeApi: IccCodeXApi | undefined

  get codeApi(): IccCodeXApi {
    return (
      this._codeApi ??
      (this._codeApi = new IccCodeXApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _calendarItemTypeApi: IccCalendarItemTypeApi | undefined

  get calendarItemTypeApi(): IccCalendarItemTypeApi {
    return (
      this._calendarItemTypeApi ??
      (this._calendarItemTypeApi = new IccCalendarItemTypeApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _medicalLocationApi: IccMedicallocationApi | undefined

  get medicalLocationApi(): IccMedicallocationApi {
    return (
      this._medicalLocationApi ??
      (this._medicalLocationApi = new IccMedicallocationApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _roleApi: IccRoleApi | undefined

  get roleApi(): IccRoleApi {
    return this._roleApi ?? (this._roleApi = new IccRoleApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }

  private _entityReferenceApi: IccEntityrefApi | undefined

  get entityReferenceApi(): IccEntityrefApi {
    return (
      this._entityReferenceApi ??
      (this._entityReferenceApi = new IccEntityrefApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _permissionApi: IccPermissionApi | undefined

  get permissionApi(): IccPermissionApi {
    return (
      this._permissionApi ??
      (this._permissionApi = new IccPermissionApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _accessLogApi: IccAccesslogXApi | undefined

  get accessLogApi(): IccAccesslogXApi {
    return (
      this._accessLogApi ??
      (this._accessLogApi = new IccAccesslogXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.params.encryptedFieldsConfig.accessLog ?? EncryptedFieldsConfig.Defaults.accessLog,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _agendaApi: IccAgendaApi | undefined

  get agendaApi(): IccAgendaApi {
    return (
      this._agendaApi ??
      (this._agendaApi = new IccAgendaApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _contactApi: IccContactXApi | undefined

  get contactApi(): IccContactXApi {
    return (
      this._contactApi ??
      (this._contactApi = new IccContactXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.userApi,
        this.authApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch,
        this.params.encryptedFieldsConfig.contact ?? EncryptedFieldsConfig.Defaults.contact,
        this.params.encryptedFieldsConfig.service ?? EncryptedFieldsConfig.Defaults.service
      ))
    )
  }

  private _formApi: IccFormXApi | undefined

  get formApi(): IccFormXApi {
    return (
      this._formApi ??
      (this._formApi = new IccFormXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _groupApi: IccGroupApi | undefined

  get groupApi(): IccGroupApi {
    return (
      this._groupApi ??
      (this._groupApi = new IccGroupApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _invoiceApi: IccInvoiceXApi | undefined

  get invoiceApi(): IccInvoiceXApi {
    return (
      this._invoiceApi ??
      (this._invoiceApi = new IccInvoiceXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.entityReferenceApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _insuranceApi: IccInsuranceApi | undefined

  get insuranceApi(): IccInsuranceApi {
    return (
      this._insuranceApi ??
      (this._insuranceApi = new IccInsuranceApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _documentApi: IccDocumentXApi | undefined

  get documentApi(): IccDocumentXApi {
    return (
      this._documentApi ??
      (this._documentApi = new IccDocumentXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.authApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _healthcareElementApi: IccHelementXApi | undefined

  get healthcareElementApi(): IccHelementXApi {
    return (
      this._healthcareElementApi ??
      (this._healthcareElementApi = new IccHelementXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.userApi,
        this.authApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.params.encryptedFieldsConfig.healthElement ?? EncryptedFieldsConfig.Defaults.healthElement,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _classificationApi: IccClassificationXApi | undefined

  get classificationApi(): IccClassificationXApi {
    return (
      this._classificationApi ??
      (this._classificationApi = new IccClassificationXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _calendarItemApi: IccCalendarItemXApi | undefined

  get calendarItemApi(): IccCalendarItemXApi {
    return (
      this._calendarItemApi ??
      (this._calendarItemApi = new IccCalendarItemXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.params.encryptedFieldsConfig.calendarItem ?? EncryptedFieldsConfig.Defaults.calendarItem,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _receiptApi: IccReceiptXApi | undefined

  get receiptApi(): IccReceiptXApi {
    return (
      this._receiptApi ??
      (this._receiptApi = new IccReceiptXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _timetableApi: IccTimeTableXApi | undefined

  get timetableApi(): IccTimeTableXApi {
    return (
      this._timetableApi ??
      (this._timetableApi = new IccTimeTableXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _patientApi: IccPatientXApi | undefined

  get patientApi(): IccPatientXApi {
    return (
      this._patientApi ??
      (this._patientApi = new IccPatientXApi(
        this.host,
        this.cryptoInitInfos.headers,
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
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.params.encryptedFieldsConfig.patient ?? EncryptedFieldsConfig.Defaults.patient,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _messageApi: IccMessageXApi | undefined

  get messageApi(): IccMessageXApi {
    return (
      this._messageApi ??
      (this._messageApi = new IccMessageXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.authApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.params.encryptedFieldsConfig.message ?? EncryptedFieldsConfig.Defaults.message,
        this.fetch
      ))
    )
  }

  private _topicApi: IccTopicXApi | undefined

  get topicApi(): IccTopicXApi {
    return (
      this._topicApi ??
      (this._topicApi = new IccTopicXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.dataOwnerApi,
        this.authApi,
        !this.cryptoInitInfos.dataOwnerRequiresAnonymousDelegation,
        this.groupSpecificAuthenticationProvider,
        this.params.encryptedFieldsConfig.topic ?? EncryptedFieldsConfig.Defaults.topic,
        this.fetch
      ))
    )
  }

  private _anonymousAccessApi: IccAnonymousAccessApi | undefined

  get anonymousAccessApi(): IccAnonymousAccessApi {
    return (
      this._anonymousAccessApi ??
      (this._anonymousAccessApi = new IccAnonymousAccessApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _applicationSettingsApi: IccApplicationsettingsApi | undefined

  get applicationSettingsApi(): IccApplicationsettingsApi {
    return (
      this._applicationSettingsApi ??
      (this._applicationSettingsApi = new IccApplicationsettingsApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _articleApi: IccArticleApi | undefined

  get articleApi(): IccArticleApi {
    return (
      this._articleApi ??
      (this._articleApi = new IccArticleApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _bekmehrApi: IccBekmehrXApi | undefined

  get bekmehrApi(): IccBekmehrXApi {
    return (
      this._bekmehrApi ??
      (this._bekmehrApi = new IccBekmehrXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.contactApi,
        this.healthcareElementApi,
        this.documentApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _beefactApi: IccBeefactApi | undefined

  get beefactApi(): IccBeefactApi {
    return (
      this._beefactApi ??
      (this._beefactApi = new IccBeefactApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _beresultexportApi: IccBeresultexportApi | undefined

  get beresultexportApi(): IccBeresultexportApi {
    return (
      this._beresultexportApi ??
      (this._beresultexportApi = new IccBeresultexportApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _beresultimportApi: IccBeresultimportApi | undefined

  get beresultimportApi(): IccBeresultimportApi {
    return (
      this._beresultimportApi ??
      (this._beresultimportApi = new IccBeresultimportApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _besamv2Api: IccBesamv2Api | undefined

  get besamv2Api(): IccBesamv2Api {
    return (
      this._besamv2Api ??
      (this._besamv2Api = new IccBesamv2Api(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _classificationTemplateApi: IccClassificationTemplateApi | undefined

  get classificationTemplateApi(): IccClassificationTemplateApi {
    return (
      this._classificationTemplateApi ??
      (this._classificationTemplateApi = new IccClassificationTemplateApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _doctemplateApi: IccDoctemplateXApi | undefined

  get doctemplateApi(): IccDoctemplateXApi {
    return (
      this._doctemplateApi ??
      (this._doctemplateApi = new IccDoctemplateXApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.cryptoApi,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _entitytemplateApi: IccEntitytemplateApi | undefined

  get entitytemplateApi(): IccEntitytemplateApi {
    return (
      this._entitytemplateApi ??
      (this._entitytemplateApi = new IccEntitytemplateApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _frontendmigrationApi: IccFrontendmigrationApi | undefined

  get frontendmigrationApi(): IccFrontendmigrationApi {
    return (
      this._frontendmigrationApi ??
      (this._frontendmigrationApi = new IccFrontendmigrationApi(
        this.host,
        this.cryptoInitInfos.headers,
        this.groupSpecificAuthenticationProvider,
        this.fetch
      ))
    )
  }

  private _icureApi: IccIcureApi | undefined

  get icureApi(): IccIcureApi {
    return (
      this._icureApi ??
      (this._icureApi = new IccIcureApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _keywordApi: IccKeywordApi | undefined

  get keywordApi(): IccKeywordApi {
    return (
      this._keywordApi ??
      (this._keywordApi = new IccKeywordApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _medexApi: IccMedexApi | undefined

  get medexApi(): IccMedexApi {
    return (
      this._medexApi ??
      (this._medexApi = new IccMedexApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _placeApi: IccPlaceApi | undefined

  get placeApi(): IccPlaceApi {
    return (
      this._placeApi ??
      (this._placeApi = new IccPlaceApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _pubsubApi: IccPubsubApi | undefined

  get pubsubApi(): IccPubsubApi {
    return (
      this._pubsubApi ??
      (this._pubsubApi = new IccPubsubApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _replicationApi: IccReplicationApi | undefined

  get replicationApi(): IccReplicationApi {
    return (
      this._replicationApi ??
      (this._replicationApi = new IccReplicationApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _tarificationApi: IccTarificationApi | undefined

  get tarificationApi(): IccTarificationApi {
    return (
      this._tarificationApi ??
      (this._tarificationApi = new IccTarificationApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  private _tmpApi: IccTmpApi | undefined

  get tmpApi(): IccTmpApi {
    return (
      this._tmpApi ?? (this._tmpApi = new IccTmpApi(this.host, this.cryptoInitInfos.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  get cryptoApi(): IccCryptoXApi {
    return this.cryptoInitInfos.cryptoApi
  }

  get dataOwnerApi(): IccDataOwnerXApi {
    return this.cryptoInitInfos.dataOwnerApi
  }

  get deviceApi(): IccDeviceXApi {
    return this.cryptoInitInfos.deviceApi
  }

  get healthcarePartyApi(): IccHcpartyXApi {
    return this.cryptoInitInfos.healthcarePartyApi
  }

  get icureMaintenanceTaskApi(): IccIcureMaintenanceXApi {
    return this.cryptoInitInfos.icureMaintenanceTaskApi
  }

  get maintenanceTaskApi(): IccMaintenanceTaskXApi {
    return this.cryptoInitInfos.maintenanceTaskApi
  }

  get userApi(): IccUserXApi {
    return this.cryptoInitInfos.userApi
  }

  async getGroupsInfo(): Promise<{ currentGroup: UserGroup | undefined; availableGroups: UserGroup[] }> {
    this.latestGroupsRequest = this.grouplessUserApi.getMatchingUsers()
    return { currentGroup: this.currentGroupInfo, availableGroups: await this.latestGroupsRequest }
  }

  async switchGroup(newGroupId: string): Promise<IcureApi> {
    const availableGroups = await this.latestGroupsRequest
    const switchedProvider = await this.groupSpecificAuthenticationProvider.switchGroup(newGroupId, availableGroups)
    const cryptoInitInfos = await initialiseCryptoWithProvider(
      this.host,
      this.fetch,
      switchedProvider,
      this.params,
      this.cryptoStrategies,
      this.cryptoApi.primitives
    )
    return new IcureApiImpl(
      cryptoInitInfos,
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

export interface IcureBasicApi extends BasicApis {
  /**
   * Get the information on groups that the current user can access and the current group that this api instance is working on.
   * Note that the values you will get for `availableGroups` may differ from the values you would get if you call {@link IccUserApi.getMatchingUsers}
   * on {@link Apis.userApi}, since the latter is specialised on the specific instance of the user in `currentGroup`.
   * - `currentGroup`: the group that this api instance is working on, or undefined if the backend environment is not multi-group.
   * - `availableGroups`: the list of groups that the current user can access with the provided secret. Empty if the backend environment is not
   * multi-group.
   */
  getGroupsInfo(): Promise<{ currentGroup: UserGroup | undefined; availableGroups: UserGroup[] }>

  /**
   * Switches the api to allow the user to work on a different group.
   * @param newGroupId the id of the group to switch to.
   * @return a new api for the specified group.
   */
  switchGroup(newGroupId: string): Promise<IcureBasicApi>
}

class IcureBasicApiImpl implements IcureBasicApi {
  private latestGroupsRequest: Promise<UserGroup[]>
  private _agendaApi: IccAgendaApi | undefined
  private _authApi: IccAuthApi | undefined
  private _codeApi: IccCodeXApi | undefined
  private _deviceApi: IccDeviceXApi | undefined
  private _entityReferenceApi: IccEntityrefApi | undefined
  private _groupApi: IccGroupApi | undefined
  private _healthcarePartyApi: IccHcpartyXApi | undefined
  private _insuranceApi: IccInsuranceApi | undefined
  private _permissionApi: IccPermissionApi | undefined
  private _userApi: IccUserXApi | undefined
  private _patientApi: IccPatientApi | undefined
  private _roleApi: IccRoleApi | undefined

  get agendaApi(): IccAgendaApi {
    return (
      this._agendaApi ?? (this._agendaApi = new IccAgendaApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get authApi(): IccAuthApi {
    return this._authApi ?? (this._authApi = new IccAuthApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get codeApi(): IccCodeXApi {
    return this._codeApi ?? (this._codeApi = new IccCodeXApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get deviceApi(): IccDeviceXApi {
    return (
      this._deviceApi ??
      (this._deviceApi = new IccDeviceXApi(
        this.host,
        this.params.headers,
        this.groupSpecificAuthenticationProvider,
        this.userApi,
        this.authApi,
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
  get groupApi(): IccGroupApi {
    return this._groupApi ?? (this._groupApi = new IccGroupApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }
  get healthcarePartyApi(): IccHcpartyXApi {
    return (
      this._healthcarePartyApi ??
      (this._healthcarePartyApi = new IccHcpartyXApi(
        this.host,
        this.params.headers,
        this.groupSpecificAuthenticationProvider,
        this.authApi,
        this.fetch
      ))
    )
  }
  get insuranceApi(): IccInsuranceApi {
    return (
      this._insuranceApi ??
      (this._insuranceApi = new IccInsuranceApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get permissionApi(): IccPermissionApi {
    return (
      this._permissionApi ??
      (this._permissionApi = new IccPermissionApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }
  get userApi(): IccUserXApi {
    return (
      this._userApi ??
      (this._userApi = new IccUserXApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.authApi, this.fetch))
    )
  }

  async getGroupsInfo(): Promise<{ currentGroup: UserGroup | undefined; availableGroups: UserGroup[] }> {
    if (!this.currentGroupInfo) return { currentGroup: undefined, availableGroups: [] }
    this.latestGroupsRequest = this.grouplessUserApi ? this.grouplessUserApi.getMatchingUsers() : this.userApi.getMatchingUsers()
    return { currentGroup: this.currentGroupInfo, availableGroups: await this.latestGroupsRequest }
  }

  get patientApi(): IccPatientApi {
    return (
      this._patientApi ?? (this._patientApi = new IccPatientApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
    )
  }

  get roleApi(): IccRoleApi {
    return this._roleApi ?? (this._roleApi = new IccRoleApi(this.host, this.params.headers, this.groupSpecificAuthenticationProvider, this.fetch))
  }

  async switchGroup(newGroupId: string): Promise<IcureBasicApi> {
    if (!this.currentGroupInfo) throw new Error('Cannot switch group: the backend environment does not support multiple groups.')
    const availableGroups = await this.latestGroupsRequest
    const switchedProvider = await this.groupSpecificAuthenticationProvider.switchGroup(newGroupId, availableGroups)
    return new IcureBasicApiImpl(
      this.host,
      switchedProvider,
      this.fetch,
      this.grouplessUserApi,
      availableGroups,
      availableGroups.find((x) => x.groupId === newGroupId)!,
      this.params
    )
  }

  constructor(
    private readonly host: string,
    private readonly groupSpecificAuthenticationProvider: AuthenticationProvider,
    private readonly fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    private readonly grouplessUserApi: IccUserApi,
    latestMatches: UserGroup[],
    private readonly currentGroupInfo: UserGroup | undefined,
    private readonly params: IcureBasicApiOptions.WithDefaults
  ) {
    this.latestGroupsRequest = Promise.resolve(latestMatches)
  }
}

export interface IcureBasicApiOptions {
  /**
   * Additional headers to use on each request made by the iCure api.
   * @default no additional headers
   */
  readonly headers?: { [headerName: string]: string }
  /**
   * Each user may exist in multiple groups, but an instance of {@link IcureApi} is specialised for a single group. This function allows you to decide
   * the group to use for a given user.
   * This functions will be called only if a user exists in at least 2 groups, and takes in input:
   * - the information on the groups the user can access (in no specific order)
   * - if the authentication method uses JWT also the current group id (undefined otherwise)
   * The function must return the id of one of the available groups.
   * @default takes the first group provided. The group chosen by this method may vary between different instantiations of the {@link IcureApi} even
   * if for the same user and if the groups available for the user do not change.
   */
  readonly groupSelector?: (availableGroupsInfo: UserGroup[], currentGroupId?: string) => Promise<string>
}

namespace IcureBasicApiOptions {
  export namespace Defaults {
    export const headers = {}
  }
  export class WithDefaults implements IcureBasicApiOptions {
    constructor(custom: IcureBasicApiOptions) {
      this.headers = custom.headers ?? Defaults.headers
      this.groupSelector = custom.groupSelector ?? ((groups) => Promise.resolve(groups[0].groupId!))
    }

    readonly headers: { [headerName: string]: string }
    readonly groupSelector: (availableGroupsInfo: UserGroup[]) => Promise<string>
  }
}

export namespace IcureBasicApi {
  /**
   * Initialises a new instance of the iCure API.
   */
  export async function initialise(
    host: string,
    authenticationOptions: AuthenticationDetails | AuthenticationProvider,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch,
    options: IcureBasicApiOptions = {}
  ): Promise<IcureBasicApi> {
    const params = new IcureBasicApiOptions.WithDefaults(options)

    const grouplessAuthenticationProvider = await getAuthenticationProvider(host, authenticationOptions, params.headers ?? {}, fetchImpl)
    const grouplessUserApi = new IccUserApi(host, params.headers, grouplessAuthenticationProvider, fetchImpl)
    const matches: UserGroup[] = await getMatchesOrEmpty(grouplessUserApi)
    const tokens = await grouplessAuthenticationProvider.getIcureTokens()
    const currentGroupId = tokens ? getGroupOfJwt(tokens.token) : undefined
    const chosenGroupId = matches.length > 1 && !!options.groupSelector ? await options.groupSelector(matches, currentGroupId) : matches[0]?.groupId
    const groupSpecificAuthenticationProvider =
      matches.length > 1 && chosenGroupId && chosenGroupId !== currentGroupId
        ? await grouplessAuthenticationProvider.switchGroup(chosenGroupId, matches)
        : grouplessAuthenticationProvider
    return new IcureBasicApiImpl(
      host,
      groupSpecificAuthenticationProvider,
      fetch,
      grouplessUserApi,
      matches,
      matches.find((match) => match.groupId === chosenGroupId),
      params
    )
  }
}

async function getMatchesOrEmpty(userApi: IccUserApi): Promise<UserGroup[]> {
  try {
    return await userApi.getMatchingUsers()
  } catch (err) {
    if (err instanceof Error && 'statusCode' in err && (err as any).statusCode === 404) return Promise.resolve([])
    else return Promise.reject(err)
  }
}
