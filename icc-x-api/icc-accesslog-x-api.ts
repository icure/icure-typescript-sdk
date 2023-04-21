import { IccAccesslogApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { AccessLog, PaginatedListAccessLog } from '../icc-api/model/models'
import * as _ from 'lodash'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'

export interface AccessLogWithPatientId extends AccessLog {
  patientId: string
}

export class IccAccesslogXApi extends IccAccesslogApi {
  crypto: IccCryptoXApi
  cryptedKeys = ['detail', 'objectId']
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
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
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the access log. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of access log.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
      preferredSfk?: string
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)

    const accessLog = _.assign(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.AccessLog',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        date: +new Date(),
        responsible: dataOwnerId,
        author: user.id,
        codes: [],
        tags: [],
        user: user.id,
        patientId: patient.id,
        accessType: 'USER_ACCESS',
      },
      h || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = options.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(user.autoDelegations?.all ?? []),
      ...(user.autoDelegations?.administrativeData ?? []),
    ]
    return new AccessLog(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(accessLog, patient.id, sfk, true, extraDelegations)
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
   */

  async findBy(hcpartyId: string, patient: models.Patient): Promise<models.AccessLog[]> {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? this.findByHCPartyPatientSecretFKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }

  async findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<AccessLog[]> {
    const accessLogs = await super.findAccessLogsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys)
    return await this.decrypt(hcPartyId, accessLogs)
  }

  decrypt(hcpId: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(
      accessLogs.map((x) => this.crypto.entities.decryptEntity(x, hcpId, (json) => new AccessLog(json)).then(({ entity }) => entity))
    )
  }

  encrypt(user: models.User, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, accessLogs)
  }

  private encryptAs(dataOwner: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(
      accessLogs.map((x) => this.crypto.entities.tryEncryptEntity(x, dataOwner, this.cryptedKeys, false, true, (json) => new AccessLog(json)))
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

  private modifyAs(dataOwner: string, accessLog: models.AccessLog): Promise<models.AccessLog> {
    return this.encryptAs(dataOwner, [_.cloneDeep(accessLog)])
      .then((als) => super.modifyAccessLog(als[0]))
      .then((accessLog) => this.decrypt(dataOwner, [accessLog]))
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
              return this.crypto.entities.owningEntityIdsOf(decryptedLog, user.healthcarePartyId as string).then(
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
    return this.crypto.entities.owningEntityIdsOf(accessLog, undefined)
  }

  /**
   * Share an existing access log with other data owners, allowing them to access the non-encrypted data of the access log and optionally also the
   * encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the access log.
   * @param accessLog the access log to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - sharePatientId: specifies if the id of the patient that this access log refers to should be shared with the delegate. Normally this would
   * be the same as objectId, but it is encrypted separately from it allowing you to give access to the patient id without giving access to the other
   * encrypted data of the access log (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated entity.
   */
  async shareWith(
    delegateId: string,
    accessLog: AccessLog,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<AccessLog> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    return await this.modifyAs(
      self,
      await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
        accessLog,
        delegateId,
        undefined,
        options.shareEncryptionKey,
        options.sharePatientId
      )
    )
  }
}
