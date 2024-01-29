import { IccAccesslogApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { AccessLog, PaginatedListAccessLog } from '../icc-api/model/models'
import * as _ from 'lodash'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { ShareResult } from './utils/ShareResult'
import { XHR } from '../icc-api/api/XHR'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields } from './utils'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

export interface AccessLogWithPatientId extends AccessLog {
  patientId: string
}

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
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the access log. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of access log.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
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
      patientId: h?.patientId ?? patient.id,
      accessType: h?.accessType ?? 'USER_ACCESS',
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk =
      options.preferredSfk ??
      (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient }))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])].map((x) => [x, AccessLevelEnum.WRITE])
      ),
      ...(options.additionalDelegates ?? {}),
    }
    return new AccessLog(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(accessLog, EntityWithDelegationTypeName.AccessLog, patient.id, sfk, true, false, extraDelegations)
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
   * 6. Do the REST call to get all helements with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the helements of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   * @param keepObsoleteVersions
   * @param usingPost
   */

  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false): Promise<models.AccessLog[]> {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? usingPost
        ? this.findByHCPartyPatientSecretFKeysArray(hcpartyId!, _.uniq(extractedKeys))
        : this.findByHCPartyPatientSecretFKeys(hcpartyId!, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }

  async findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<AccessLog[]> {
    const accessLogs = await super.findAccessLogsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys)
    return await this.decrypt(hcPartyId, accessLogs)
  }

  findByHCPartyPatientSecretFKeysArray(hcPartyId: string, secretFKeys: string[]): Promise<Array<AccessLog> | any> {
    return super.findAccessLogsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys).then((accesslogs) => this.decrypt(hcPartyId, accesslogs))
  }

  decrypt(hcpId: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(
      accessLogs.map((x) =>
        this.crypto.xapi.decryptEntity(x, EntityWithDelegationTypeName.AccessLog, (json) => new AccessLog(json)).then(({ entity }) => entity)
      )
    )
  }

  encrypt(user: models.User, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    const owner = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.encryptAs(owner, accessLogs)
  }

  private encryptAs(dataOwner: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(
      accessLogs.map((x) =>
        this.crypto.xapi.tryEncryptEntity(
          x,
          EntityWithDelegationTypeName.AccessLog,
          this.encryptedFields,
          false,
          false,
          (json) => new AccessLog(json)
        )
      )
    )
  }

  createAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  createAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((als) => super.createAccessLog(als[0]))
          .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [accessLog]))
          .then((als) => als[0])
      : Promise.resolve()
  }

  getAccessLog(accessLogId: string): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  getAccessLogWithUser(user: models.User, accessLogId: string): Promise<models.AccessLog | any> {
    return super
      .getAccessLog(accessLogId)
      .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [accessLog]))
      .then((als) => als[0])
  }

  listAccessLogs(fromEpoch?: number, toEpoch?: number, startKey?: number, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

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

  modifyAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  async modifyAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | null> {
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, _.cloneDeep(body)) : null
  }

  private async modifyAs(owner: string, body: models.AccessLog): Promise<models.AccessLog> {
    return this.encryptAs(owner, [_.cloneDeep(body)])
      .then((als) => super.modifyAccessLog(als[0]))
      .then((accessLog) => this.decrypt(owner, [accessLog]))
      .then((als) => als[0])
  }

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

  async findLatestAccessLogsOfPatientsWithUser(user: models.User, userId: string, limit = 100, startDate?: number): Promise<models.AccessLog[]> {
    let foundAccessLogs: AccessLogWithPatientId[] = [],
      nextKeyPair: models.PaginatedDocumentKeyIdPairObject | undefined = undefined
    const numberRequestedAccessLogs = 100
    const MAX_WHILE_ITERATIONS = 5

    for (let currentIteration = 0; foundAccessLogs.length < limit && currentIteration < MAX_WHILE_ITERATIONS; currentIteration++) {
      const currentLimit = limit - foundAccessLogs.length
      const { rows: logs, nextKeyPair: newNextKeyPair }: models.PaginatedListAccessLog = (await super.findByUserAfterDate(
        userId,
        'USER_ACCESS',
        startDate,
        nextKeyPair && JSON.stringify(nextKeyPair.startKey!),
        nextKeyPair && nextKeyPair.startKeyDocId!,
        numberRequestedAccessLogs,
        true
      )) as models.PaginatedListAccessLog
      const logsWithPatientId: AccessLogWithPatientId[] = await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, logs as AccessLog[]).then(
        (decryptedLogs) =>
          Promise.all(
            _.map(decryptedLogs, (decryptedLog) => {
              return this.crypto.xapi
                .owningEntityIdsOf({ entity: decryptedLog, type: EntityWithDelegationTypeName.AccessLog }, user.healthcarePartyId as string)
                .then(
                  (keys) =>
                    ({
                      ...decryptedLog,
                      patientId: _.head(keys),
                    } as AccessLogWithPatientId)
                )
            })
          )
      )

      const uniqueLogs: AccessLogWithPatientId[] = _.chain(logsWithPatientId)
        .reject((log) => _.some(foundAccessLogs, ({ patientId }) => patientId === log.patientId))
        .uniqBy((log: AccessLogWithPatientId) => log.patientId)
        .value()
        .slice(0, currentLimit)

      foundAccessLogs = [...foundAccessLogs, ...uniqueLogs]

      if ((logs || []).length < numberRequestedAccessLogs) {
        break
      } else if (newNextKeyPair) {
        nextKeyPair = newNextKeyPair
      } else {
        break
      }
    }

    return foundAccessLogs
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
        { entity: updatedEntity, type: EntityWithDelegationTypeName.AccessLog },
        true,
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: undefined,
            },
          ])
        ),
        (x) => this.bulkShareAccessLogs(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: AccessLog
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.AccessLog })
  }

  getEncryptionKeysOf(entity: AccessLog): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.AccessLog }, undefined)
  }

  createDelegationDeAnonymizationMetadata(entity: AccessLog, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.AccessLog },
      delegates
    )
  }
}
