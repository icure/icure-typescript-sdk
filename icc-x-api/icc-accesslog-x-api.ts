import { IccAccesslogApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { AccessLog, ListOfIds, PaginatedListAccessLog } from '../icc-api/model/models'
import { cloneDeep } from './utils/collection-utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { ShareResult } from './utils/ShareResult'
import { XHR } from '../icc-api/api/XHR'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields } from './utils'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { SecretIdUseOption } from './crypto/SecretIdUseOption'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

export class IccAccesslogXApi extends IccAccesslogApi implements EncryptedEntityXApi<models.AccessLog> {
  private readonly encryptedFields: EncryptedFieldsManifest
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.AccessLog))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    private readonly autofillAuthor: boolean,
    cryptedKeys = ['detail', 'objectId'],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.dataOwnerApi = dataOwnerApi
    this.encryptedFields = parseEncryptedFields(cryptedKeys, 'AccessLog.')
  }

  /**
   * Creates a new instance of access log with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this access log refers to.
   * @param h initialised data for the access log. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - sfkOption: specifies which sfk of the owning entity to use.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of access log.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      sfkOption?: SecretIdUseOption
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const accessLog = {
      ...(h ?? {}),
      _type: 'org.taktik.icure.entities.AccessLog',
      id: h?.id ?? this.crypto.primitives.randomUuid(),
      created: h?.created ?? new Date().getTime(),
      modified: h?.modified ?? new Date().getTime(),
      date: h?.date ?? new Date().getTime(),
      responsible: h?.responsible ?? (this.autofillAuthor ? dataOwnerId : undefined),
      author: h?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: h?.codes ?? [],
      tags: h?.tags ?? [],
      user: h?.user ?? user.id,
      accessType: h?.accessType ?? 'USER_ACCESS',
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = await this.crypto.xapi.resolveSecretIdUseOptions(
      { entity: patient, type: EntityWithDelegationTypeName.Patient },
      options.sfkOption ?? SecretIdUseOption.UseAnySharedWithParent
    )
    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])].map((x) => [x, AccessLevelEnum.WRITE])
          )),
      ...(options.additionalDelegates ?? {}),
    }
    return new AccessLog(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          accessLog,
          EntityWithDelegationTypeName.AccessLog,
          patient.id,
          sfk,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
        .then((x) => x.updatedEntity)
    )
  }

  /**
   * Creates a new instance of access log with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param h initialised data for the access log. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of access log.
   */
  async newInstanceNoPatient(
    user: models.User,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const accessLog = {
      ...(h ?? {}),
      _type: 'org.taktik.icure.entities.AccessLog',
      id: h?.id ?? this.crypto.primitives.randomUuid(),
      created: h?.created ?? new Date().getTime(),
      modified: h?.modified ?? new Date().getTime(),
      date: h?.date ?? new Date().getTime(),
      responsible: h?.responsible ?? (this.autofillAuthor ? dataOwnerId : undefined),
      author: h?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: h?.codes ?? [],
      tags: h?.tags ?? [],
      user: h?.user ?? user.id,
      accessType: h?.accessType ?? 'USER_LOGIN',
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])].map((x) => [x, AccessLevelEnum.WRITE])
          )),
      ...(options.additionalDelegates ?? {}),
    }
    return new AccessLog(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          accessLog,
          EntityWithDelegationTypeName.AccessLog,
          undefined,
          undefined,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
        .then((x) => x.updatedEntity)
    )
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all access logs with (allSecretForeignKeysDelimitedByComma, hcpartyId)
   *
   * After these painful steps, you have the access logs of the patient.
   *
   * @deprecated use {@link findIdsBy} instead
   * @param hcpartyId
   * @param patient (Promise)
   * @param usingPost
   */
  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false): Promise<models.AccessLog[]> {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? usingPost
        ? this.findByHCPartyPatientSecretFKeysArray(hcpartyId!, [...new Set(extractedKeys)])
        : this.findByHCPartyPatientSecretFKeys(hcpartyId!, [...new Set(extractedKeys)].join(','))
      : Promise.resolve([])
  }

  /**
   * Same as `findBy` but it will only return the ids of the access logs. It can also filter the access logs where AccessLog.date is between
   * startDate and endDate in ascending or descending order by that field. (default: ascending).
   */
  async findIdsBy(hcpartyId: string, patient: models.Patient, startDate?: number, endDate?: number, descending?: boolean): Promise<string[]> {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    return extractedKeys && extractedKeys.length > 0
      ? this.findAccessLogIdsByDataOwnerPatientDate(hcpartyId, [...new Set(extractedKeys)], startDate, endDate, descending)
      : Promise.resolve([])
  }

  /**
   * @deprecated use {@link findAccessLogIdsByDataOwnerPatientDate} instead
   */
  async findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<AccessLog[]> {
    const accessLogs = await super.findAccessLogsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys)
    return await this.decrypt(hcPartyId, accessLogs)
  }

  /**
   * @deprecated use {@link findAccessLogIdsByDataOwnerPatientDate} instead
   */
  findByHCPartyPatientSecretFKeysArray(hcPartyId: string, secretFKeys: string[]): Promise<Array<AccessLog> | any> {
    return super.findAccessLogsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys).then((accesslogs) => this.decrypt(hcPartyId, accesslogs))
  }

  /**
   * Decrypts a list of access logs using the current data owner's keys.
   * @param hcpId the id of the healthcare party performing the decryption.
   * @param accessLogs the access logs to decrypt.
   * @return the decrypted access logs.
   */
  async decrypt(hcpId: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return (await this.crypto.xapi.tryDecryptEntities(accessLogs, EntityWithDelegationTypeName.AccessLog, (json) => new AccessLog(json))).map(
      ({ entity }) => entity
    )
  }

  /**
   * Encrypts the encrypted fields of a list of access logs.
   * @param user the current user, used to determine the data owner for encryption.
   * @param accessLogs the access logs to encrypt.
   * @return the encrypted access logs.
   */
  encrypt(user: models.User, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    const owner = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.encryptAs(owner, accessLogs)
  }

  private async encryptAs(dataOwner: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return this.crypto.xapi.tryEncryptEntities(
      accessLogs,
      EntityWithDelegationTypeName.AccessLog,
      this.encryptedFields,
      false,
      false,
      (json) => new AccessLog(json)
    )
  }

  /**
   * @throws always. Use {@link createAccessLogWithUser} instead.
   */
  createAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Creates an access log after encrypting its content.
   * @param user the current user, used for encryption.
   * @param body the access log to create.
   * @return the created and decrypted access log.
   */
  createAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | any> {
    return body
      ? this.encrypt(user, [cloneDeep(body)])
          .then((als) => super.createAccessLog(als[0]))
          .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [accessLog]))
          .then((als) => als[0])
      : Promise.resolve()
  }

  /**
   * @throws always. Use {@link getAccessLogWithUser} instead.
   */
  getAccessLog(accessLogId: string): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Retrieves an access log by id and decrypts it.
   * @param user the current user, used for decryption.
   * @param accessLogId the id of the access log to retrieve.
   * @return the decrypted access log.
   */
  getAccessLogWithUser(user: models.User, accessLogId: string): Promise<models.AccessLog | any> {
    return super
      .getAccessLog(accessLogId)
      .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [accessLog]))
      .then((als) => als[0])
  }

  /**
   * @throws always. Use {@link getAccessLogsWithUser} instead.
   */
  async getAccessLogs(ids: ListOfIds): Promise<AccessLog[]> {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Retrieves multiple access logs by their ids and decrypts them.
   * @param user the current user, used for decryption.
   * @param ids the list of access log ids to retrieve.
   * @return the decrypted access logs.
   */
  getAccessLogsWithUser(user: models.User, ids: ListOfIds): Promise<AccessLog[]> {
    return super.getAccessLogs(ids).then((accessLogs) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, accessLogs))
  }

  /**
   * @throws always. Use {@link listAccessLogsWithUser} instead.
   */
  listAccessLogs(fromEpoch?: number, toEpoch?: number, startKey?: number, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Lists access logs within a date range and decrypts them.
   * @param user the current user, used for decryption.
   * @param fromEpoch the start of the date range (epoch in ms).
   * @param toEpoch the end of the date range (epoch in ms).
   * @param startKey the pagination start key.
   * @param startDocumentId the pagination start document id.
   * @param limit the maximum number of results to return.
   * @param descending if true, results are returned in descending order.
   * @return a paginated list of decrypted access logs.
   */
  listAccessLogsWithUser(
    user: models.User,
    fromEpoch?: number,
    toEpoch?: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): Promise<PaginatedListAccessLog> {
    return super
      .listAccessLogs(fromEpoch, toEpoch, startKey, startDocumentId, limit, descending)
      .then((accessLog) =>
        this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr }))
      )
  }

  /**
   * @throws always. Use {@link modifyAccessLogWithUser} instead.
   */
  modifyAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Modifies an access log after encrypting its content.
   * @param user the current user, used for encryption/decryption.
   * @param body the access log with updated fields.
   * @return the modified and decrypted access log, or null if body was not provided.
   */
  async modifyAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | null> {
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, cloneDeep(body)) : null
  }

  private async modifyAs(owner: string, body: models.AccessLog): Promise<models.AccessLog> {
    return this.encryptAs(owner, [cloneDeep(body)])
      .then((als) => super.modifyAccessLog(als[0]))
      .then((accessLog) => this.decrypt(owner, [accessLog]))
      .then((als) => als[0])
  }

  /**
   * @throws always. Use {@link findByUserAfterDateWithUser} instead.
   */
  findByUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  /**
   * Finds access logs by user id after a given date and decrypts them.
   * @param user the current user, used for decryption.
   * @param userId the id of the user whose access logs to find.
   * @param accessType optional access type filter.
   * @param startDate optional start date filter (epoch in ms).
   * @param startKey the pagination start key.
   * @param startDocumentId the pagination start document id.
   * @param limit the maximum number of results to return.
   * @param descending if true, results are returned in descending order.
   * @return a paginated list of decrypted access logs.
   */
  findByUserAfterDateWithUser(
    user: models.User,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    descending?: boolean
  ): Promise<models.AccessLog | any> {
    return super
      .findByUserAfterDate(userId, accessType, startDate, startKey, startDocumentId, limit, descending)
      .then((accessLog) =>
        this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr }))
      )
  }

  /**
   * @param accessLog an access log
   * @return the id of the patient that the access log refers to, retrieved from the encrypted metadata (not from the decrypted entity body). Normally
   * there should only be one element in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(accessLog: AccessLog): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: accessLog, type: EntityWithDelegationTypeName.AccessLog }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given access log
   */
  async hasWriteAccess(accessLog: AccessLog): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: accessLog, type: EntityWithDelegationTypeName.AccessLog })
  }

  /**
   * Share an existing access log with other data owners, allowing them to access the non-encrypted data of the access log and optionally also the
   * encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the access log.
   * @param accessLog the access log to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - sharePatientId: specifies if the id of the patient that this access log refers to should be shared with the delegate. Normally this would
   * be the same as objectId, but it is encrypted separately from it allowing you to give access to the patient id without giving access to the other
   * encrypted data of the access log (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    accessLog: AccessLog,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<AccessLog> {
    return this.shareWithMany(accessLog, { [delegateId]: options })
  }

  /**
   * Share an existing access log with other data owners, allowing them to access the non-encrypted data of the access log and optionally also the
   * encrypted content, with read-only or read-write permissions.
   * @param accessLog the access log to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - sharePatientId: specifies if the id of the patient that this access log refers to should be shared with the delegate. Normally this would
   * be the same as objectId, but it is encrypted separately from it allowing you to give access to the patient id without giving access to the other
   * encrypted data of the access log (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    accessLog: AccessLog,
    delegates: {
      [delegateId: string]: {
        shareSecretId?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<AccessLog> {
    return (await this.tryShareWithMany(accessLog, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing access log with other data owners, allowing them to access the non-encrypted data of the access log and optionally also the
   * encrypted content, with read-only or read-write permissions.
   * @param accessLog the access log to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - sharePatientId: specifies if the id of the patient that this access log refers to should be shared with the delegate. Normally this would
   * be the same as objectId, but it is encrypted separately from it allowing you to give access to the patient id without giving access to the other
   * encrypted data of the access log (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    accessLog: AccessLog,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<AccessLog>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(accessLog, EntityWithDelegationTypeName.AccessLog)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyAs(self, entityWithEncryptionKey) : accessLog
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.AccessLog,
        },
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: options.shareSecretIds,
            },
          ])
        ),
        (x) => this.bulkShareAccessLogs(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  /**
   * Retrieves the data owners that have access to the given access log, along with their access levels.
   * @param entity the access log.
   * @return an object containing a map of data owner ids to their access levels, and a flag indicating if there are unknown anonymous data owners.
   */
  getDataOwnersWithAccessTo(
    entity: AccessLog
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.AccessLog })
  }

  /**
   * Retrieves the encryption keys of the given access log.
   * @param entity the access log.
   * @return the encryption key ids.
   */
  getEncryptionKeysOf(entity: AccessLog): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.AccessLog }, undefined)
  }

  /**
   * Creates or updates de-anonymization metadata for the given access log, allowing the specified delegates to
   * identify the data owners that have access to it.
   * @param entity the access log.
   * @param delegates the data owner ids for which to create de-anonymization metadata.
   */
  createDelegationDeAnonymizationMetadata(entity: AccessLog, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.AccessLog },
      delegates
    )
  }

  /**
   * Like {@link getConflictsForEntity} but additionally decrypts the conflicting revisions for the given user.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param entityId the id of the access log to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the access log.
   */
  getConflictsForEntityWithUser(user: models.User, entityId: string): Promise<Array<models.AccessLog>> {
    return super.getConflictsForEntity(entityId).then((als) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), als))
  }

  /**
   * Like {@link declareConflictWinner} but encrypts the winning revision before sending it and decrypts the saved
   * winner returned by the backend.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerWithUser(
    user: models.User,
    request: models.ConflictResolutionRequest<models.AccessLog>
  ): Promise<models.ConflictResolutionResult<models.AccessLog>> {
    const encrypted = (await this.encrypt(user, [cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinner({ ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), [result.document]))[0]
    return result
  }

  /**
   * Like {@link getConflictsForEntityWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param groupId the id of the group the access log belongs to.
   * @param entityId the id of the access log to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the access log.
   */
  getConflictsForEntityInGroupWithUser(user: models.User, groupId: string, entityId: string): Promise<Array<models.AccessLog>> {
    return super.getConflictsForEntityInGroup(groupId, entityId).then((als) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), als))
  }

  /**
   * Like {@link declareConflictWinnerWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param groupId the id of the group the access log belongs to.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerInGroupWithUser(
    user: models.User,
    groupId: string,
    request: models.ConflictResolutionRequest<models.AccessLog>
  ): Promise<models.ConflictResolutionResult<models.AccessLog>> {
    const encrypted = (await this.encrypt(user, [cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinnerInGroup(groupId, { ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), [result.document]))[0]
    return result
  }
}
