import { IccAccesslogApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { AccessLog, PaginatedListAccessLog } from '../icc-api/model/models'
import * as _ from 'lodash'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider } from './auth/AuthenticationProvider'

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
    authenticationProvider: AuthenticationProvider,
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

  async newInstance(user: models.User, patient: models.Patient, h: any, preferredSfk?: string, delegationTags?: string[]) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

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

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const sfk = preferredSfk ?? (await this.crypto.entities.secretIdsOf(patient, ownerId))[0]
    const extraDelegations = [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new AccessLog(
      this.crypto.entities
        .entityWithInitialisedEncryptionMetadata(accessLog, patient.id, sfk, true, extraDelegations, delegationTags)
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

  async findBy(hcpartyId: string, patient: models.Patient) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0] // TODO should this really be topmost parent?
    return extractedKeys && extractedKeys.length > 0
      ? this.findByHCPartyPatientSecretFKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }

  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<AccessLog> | any> {
    return super.findAccessLogsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((accesslogs) => this.decrypt(hcPartyId, accesslogs))
  }

  decrypt(hcpId: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(accessLogs.map((x) => this.crypto.entities.decryptEntity(x, hcpId, (json) => new AccessLog(json))))
  }

  encrypt(user: models.User, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(accessLogs.map((x) => this.crypto.entities.encryptEntity(x, user, this.cryptedKeys, (json) => new AccessLog(json))))
  }

  createAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  createAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((als) => super.createAccessLog(als[0]))
          .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [accessLog]))
          .then((als) => als[0])
      : Promise.resolve()
  }

  getAccessLog(accessLogId: string): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  getAccessLogWithUser(user: models.User, accessLogId: string): Promise<models.AccessLog | any> {
    return super
      .getAccessLog(accessLogId)
      .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [accessLog]))
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
        this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr }))
      )
  }

  modifyAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  async modifyAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | null> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((als) => super.modifyAccessLog(als[0]))
          .then((accessLog) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [accessLog]))
          .then((als) => als[0])
      : null
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
        this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr }))
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
      const logsWithPatientId: AccessLogWithPatientId[] = await this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, logs as AccessLog[]).then(
        (decryptedLogs) =>
          Promise.all(
            _.map(decryptedLogs, (decryptedLog) => {
              return this.crypto.entities.parentIdsOf(decryptedLog, user.healthcarePartyId as string).then(
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
}
