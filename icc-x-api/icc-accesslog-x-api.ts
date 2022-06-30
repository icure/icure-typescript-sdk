import { IccAccesslogApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'
import { AccessLog, PaginatedListAccessLog } from '../icc-api/model/models'

import * as _ from 'lodash'
import { crypt, decrypt, hex2ua, ua2utf8, utf8_2ua } from './utils'
import { IccUserXApi } from './icc-user-x-api'

export interface AccessLogWithPatientId extends AccessLog {
  patientId: string
}

export class IccAccesslogXApi extends IccAccesslogApi {
  crypto: IccCryptoXApi
  cryptedKeys = ['detail', 'objectId']
  userApi: IccUserXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
  }

  newInstance(user: models.User, patient: models.Patient, h: any) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    const accessslog = _.assign(
      {
        id: this.crypto.randomUuid(),
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

    return this.crypto.extractDelegationsSFKs(patient, dataOwnerId).then(async (secretForeignKeys) => {
      const dels = await this.crypto.initObjectDelegations(accessslog, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0])
      const eks = await this.crypto.initEncryptionKeys(accessslog, dataOwnerId!)

      _.extend(accessslog, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys,
      })

      let promise = Promise.resolve(accessslog)
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then(() =>
            this.crypto.addDelegationsAndEncryptionKeys(patient, accessslog, dataOwnerId!, delegateId, dels.secretId, eks.secretId).catch((e) => {
              console.log(e)
              return accessslog
            })
          ))
      )
      return promise
    })
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

  findBy(hcpartyId: string, patient: models.Patient) {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then((secretForeignKeys) =>
        secretForeignKeys && secretForeignKeys.extractedKeys && secretForeignKeys.extractedKeys.length > 0
          ? this.findByHCPartyPatientSecretFKeys(secretForeignKeys.hcpartyId!, _.uniq(secretForeignKeys.extractedKeys).join(','))
          : Promise.resolve([])
      )
  }

  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<AccessLog> | any> {
    return super.findAccessLogsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((accesslogs) => this.decrypt(hcPartyId, accesslogs))
  }

  decrypt(hcpId: string, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    //First check that we have no dangling delegation

    return Promise.all(
      accessLogs.map((accessLog) => {
        return accessLog.encryptedSelf
          ? this.crypto
              .extractKeysFromDelegationsForHcpHierarchy(
                hcpId!,
                accessLog.id!,
                _.size(accessLog.encryptionKeys) ? accessLog.encryptionKeys! : accessLog.delegations!
              )
              .then(({ extractedKeys: sfks }) => {
                if (!sfks || !sfks.length) {
                  //console.log("Cannot decrypt contact", ctc.id)
                  return Promise.resolve(accessLog)
                }
                return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, ''))).then((key) =>
                  decrypt(accessLog, (ec) =>
                    this.crypto.AES.decrypt(key, ec).then((dec) => {
                      const jsonContent = dec && ua2utf8(dec)
                      try {
                        return JSON.parse(jsonContent)
                      } catch (e) {
                        console.log('Cannot parse access log', accessLog.id, jsonContent || 'Invalid content')
                        return {}
                      }
                    })
                  )
                )
              })
          : Promise.resolve(accessLog)
      })
    )
  }

  initEncryptionKeys(user: models.User, accessLog: models.AccessLog): Promise<models.AccessLog> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto.initEncryptionKeys(accessLog, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(accessLog, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((accessLog) =>
            this.crypto.appendEncryptionKeys(accessLog, dataOwnerId!, delegateId, eks.secretId).then((extraEks) => {
              return _.extend(accessLog, {
                encryptionKeys: extraEks.encryptionKeys,
              })
            })
          ))
      )
      return promise
    })
  }

  encrypt(user: models.User, accessLogs: Array<models.AccessLog>): Promise<Array<models.AccessLog>> {
    return Promise.all(
      accessLogs.map((accessLog) =>
        (accessLog.encryptionKeys && Object.keys(accessLog.encryptionKeys).length
          ? Promise.resolve(accessLog)
          : this.initEncryptionKeys(user, accessLog)
        )
          .then((accessLog: AccessLog) =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(this.userApi.getDataOwnerOf(user)!, accessLog.id!, accessLog.encryptionKeys!)
          )
          .then(async (eks: { extractedKeys: Array<string>; hcpartyId: string }) => {
            const rawKey = eks.extractedKeys[0].replace(/-/g, '')
            const key = await this.crypto.AES.importKey('raw', hex2ua(rawKey))
            return crypt(
              accessLog,
              (obj: { [key: string]: string }) => this.crypto.AES.encrypt(key, utf8_2ua(JSON.stringify(obj)), rawKey),
              this.cryptedKeys
            )
          })
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
          .then((accessLog) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [accessLog]))
          .then((als) => als[0])
      : Promise.resolve()
  }

  getAccessLog(accessLogId: string): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  getAccessLogWithUser(user: models.User, accessLogId: string): Promise<models.AccessLog | any> {
    return super
      .getAccessLog(accessLogId)
      .then((accessLog) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [accessLog]))
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
      .then((accessLog) => this.decrypt(this.userApi.getDataOwnerOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr })))
  }

  modifyAccessLog(body?: models.AccessLog): never {
    throw new Error('Cannot call a method that returns access logs without providing a user for de/encryption')
  }

  async modifyAccessLogWithUser(user: models.User, body?: models.AccessLog): Promise<models.AccessLog | null> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((als) => super.modifyAccessLog(als[0]))
          .then((accessLog) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [accessLog]))
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
      .then((accessLog) => this.decrypt(this.userApi.getDataOwnerOf(user)!, accessLog.rows!).then((dr) => Object.assign(accessLog, { rows: dr })))
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
      const logsWithPatientId: AccessLogWithPatientId[] = await this.decrypt(this.userApi.getDataOwnerOf(user)!, logs as AccessLog[]).then(
        (decryptedLogs) =>
          Promise.all(
            _.map(decryptedLogs, (decryptedLog) => {
              return this.crypto.extractCryptedFKs(decryptedLog, user.healthcarePartyId as string).then(
                (keys) =>
                  ({
                    ...decryptedLog,
                    patientId: _.head(keys.extractedKeys),
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
