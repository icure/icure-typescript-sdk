import { IccPatientApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccContactXApi } from './icc-contact-x-api'
import { IccFormXApi } from './icc-form-x-api'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { IccInvoiceXApi } from './icc-invoice-x-api'
import { IccDocumentXApi } from './icc-document-x-api'
import { IccHelementXApi } from './icc-helement-x-api'
import { IccClassificationXApi } from './icc-classification-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import {
  CalendarItem,
  Classification,
  Delegation,
  Device,
  Document,
  HealthcareParty,
  IcureStub,
  Invoice,
  ListOfIds,
  Patient,
} from '../icc-api/model/models'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { b2a, hex2ua, string2ua, ua2hex, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { crypt, decrypt, retry } from './utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends IccPatientApi {
  crypto: IccCryptoXApi
  contactApi: IccContactXApi
  formApi: IccFormXApi
  helementApi: IccHelementXApi
  invoiceApi: IccInvoiceXApi
  hcpartyApi: IccHcpartyXApi
  documentApi: IccDocumentXApi
  classificationApi: IccClassificationXApi
  calendarItemApi: IccCalendarItemXApi
  dataOwnerApi: IccDataOwnerXApi

  private readonly encryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    contactApi: IccContactXApi,
    formApi: IccFormXApi,
    helementApi: IccHelementXApi,
    invoiceApi: IccInvoiceXApi,
    documentApi: IccDocumentXApi,
    hcpartyApi: IccHcpartyXApi,
    classificationApi: IccClassificationXApi,
    dataOwnerApi: IccDataOwnerXApi,
    calendarItemaApi: IccCalendarItemXApi,
    encryptedKeys: Array<string> = ['note'],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.contactApi = contactApi
    this.formApi = formApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
    this.classificationApi = classificationApi
    this.calendarItemApi = calendarItemaApi
    this.dataOwnerApi = dataOwnerApi

    this.encryptedKeys = encryptedKeys
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.User, p: any = {}, delegates: string[] = []) {
    const patient = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Patient',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      p || {}
    )
    return this.initDelegationsAndEncryptionKeys(patient, user, undefined, delegates)
  }

  completeNames(patient: models.Patient): models.Patient {
    let finalPatient = patient

    if (!!finalPatient.lastName && !hasName(finalPatient, models.PersonName.UseEnum.Official)) {
      finalPatient = garnishPersonWithName(finalPatient, models.PersonName.UseEnum.Official, finalPatient.lastName, finalPatient.firstName)
    }

    if (!!finalPatient.maidenName && !hasName(finalPatient, models.PersonName.UseEnum.Maiden)) {
      finalPatient = garnishPersonWithName(finalPatient, models.PersonName.UseEnum.Maiden, finalPatient.maidenName, finalPatient.firstName)
    }

    if (!!finalPatient.alias && !hasName(finalPatient, models.PersonName.UseEnum.Nickname)) {
      finalPatient = garnishPersonWithName(finalPatient, models.PersonName.UseEnum.Nickname, finalPatient.alias, finalPatient.firstName)
    }

    if (!finalPatient.lastName && !!hasName(finalPatient, models.PersonName.UseEnum.Official)) {
      const officialName = findName(finalPatient, models.PersonName.UseEnum.Official)
      finalPatient = {
        ...finalPatient,
        lastName: officialName!.lastName,
        firstName: officialName!.firstNames?.[0],
      }
    }

    if (!finalPatient.maidenName && !!hasName(finalPatient, models.PersonName.UseEnum.Maiden)) {
      finalPatient = {
        ...finalPatient,
        maidenName: findName(finalPatient, models.PersonName.UseEnum.Maiden)!.lastName,
      }
    }

    if (!finalPatient.alias && !!hasName(finalPatient, models.PersonName.UseEnum.Nickname)) {
      finalPatient = {
        ...finalPatient,
        alias: findName(finalPatient, models.PersonName.UseEnum.Nickname)!.lastName,
      }
    }

    return finalPatient
  }

  async initDelegationsAndEncryptionKeys(
    patient: models.Patient,
    user: models.User,
    secretForeignKey: string | undefined = undefined,
    delegates: string[] = []
  ): Promise<models.Patient> {
    function updatePatientWithDataOwnerIfSame(dataOwner: Patient | Device | HealthcareParty) {
      if (dataOwner.id === patient.id) {
        _.extend(patient, {
          rev: dataOwner.rev,
          publicKey: dataOwner.publicKey,
          aesExchangeKeys: dataOwner.aesExchangeKeys,
          hcPartyKeys: dataOwner.hcPartyKeys,
        })
      }
    }

    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    const dels = await this.crypto.initObjectDelegations(patient, null, dataOwnerId!, null)
    updatePatientWithDataOwnerIfSame(dels.owner)
    const eks = await this.crypto.initEncryptionKeys(patient, dataOwnerId!)
    updatePatientWithDataOwnerIfSame(eks.modifiedOwner)
    patient.delegations = dels.delegations
    patient.encryptionKeys = eks.encryptionKeys

    let promise = Promise.resolve(patient)
    _.uniq(
      delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
    ).forEach(
      (delegateId) =>
        (promise = promise.then((patient) =>
          this.crypto.addDelegationsAndEncryptionKeys(null, patient, dataOwnerId!, delegateId, dels.secretId, eks.secretId).catch((e) => {
            console.log(e)
            return patient
          })
        ))
    )
    ;(user.autoDelegations && user.autoDelegations.anonymousMedicalInformation ? user.autoDelegations.anonymousMedicalInformation : []).forEach(
      (delegateId) =>
        (promise = promise.then((patient) =>
          this.crypto.addDelegationsAndEncryptionKeys(null, patient, dataOwnerId!, delegateId, null, eks.secretId).catch((e) => {
            console.log(e)
            return patient
          })
        ))
    )
    return promise
  }

  initConfidentialDelegation(patient: models.Patient, user: models.User): Promise<models.Patient | null> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    return this.crypto.extractPreferredSfk(patient, dataOwnerId!, true).then((k) => {
      if (!k) {
        const secretId = this.crypto.randomUuid()
        return this.crypto
          .decryptAndImportAesHcPartyKeysForDelegators([dataOwnerId!], dataOwnerId!)
          .then((hcPartyKeys) => {
            return this.crypto.AES.encrypt(hcPartyKeys[0].key, string2ua(patient.id + ':' + secretId).buffer as ArrayBuffer)
          })
          .then((newDelegation) => {
            ;(patient.delegations![dataOwnerId!] || (patient.delegations![dataOwnerId!] = [])).push(
              new Delegation({
                owner: dataOwnerId,
                delegatedTo: dataOwnerId,
                tag: 'confidential',
                key: ua2hex(newDelegation),
              })
            )
            return patient.rev ? this.modifyPatientWithUser(user, patient) : this.createPatientWithUser(user, patient)
          })
      } else {
        return patient
      }
    })
  }

  createPatient(body?: models.Patient): never {
    throw new Error('Cannot call a method that returns patients without providing a user for de/encryption')
  }

  createPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(this.completeNames(body))])
          .then((pats) => super.createPatient(pats[0]))
          .then((p) => this.decrypt(user, [p]))
          .then((pats) => pats[0])
      : Promise.resolve(null)
  }

  filterBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: models.FilterChainPatient
  ): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  filterByWithUser(
    user: models.User,
    filterChain: models.FilterChainPatient,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .filterPatientsBy(startKey, startDocumentId, limit, skip, sort, desc, filterChain)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  findByAccessLogUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  findByAccessLogUserAfterDateWithUser(
    user: models.User,
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .findByAccessLogUserAfterDate(userId, accessType, startDate, startKey, startDocumentId, limit)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  findByAccessLogUserAfterDate_1(externalId: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  findByExternalIdWithUser(user: models.User, externalId: string): Promise<models.Patient | any> {
    return super
      .findByExternalId(externalId)
      .then((pats) => this.decrypt(user, [pats]))
      .then((x) => x[0])
  }

  findByNameBirthSsinAuto(
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  findByNameBirthSsinAutoWithUser(
    user: models.User,
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .findByNameBirthSsinAuto(healthcarePartyId, filterValue, startKey, startDocumentId, limit, sortDirection)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  fuzzySearch(firstName?: string, lastName?: string, dateOfBirth?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  fuzzySearchWithUser(user: models.User, firstName?: string, lastName?: string, dateOfBirth?: number): Promise<Array<models.Patient> | any> {
    return super.fuzzySearch(firstName, lastName, dateOfBirth).then((pats) => this.decrypt(user, pats))
  }

  getPatient(patientId: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  getPatientRaw(patientId: string): Promise<models.Patient | any> {
    return super.getPatient(patientId)
  }

  getPatientWithUser(user: models.User, patientId: string): Promise<models.Patient | any> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(user, [p], false))
      .then((pats) => pats[0].patient)
  }

  getPotentiallyEncryptedPatientWithUser(user: models.User, patientId: string): Promise<{ patient: models.Patient; decrypted: boolean }> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(user, [p], false))
      .then((pats) => pats[0])
  }

  getPatients(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  getPatientsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<models.Patient> | any> {
    return super.getPatients(body).then((pats) => this.decrypt(user, pats))
  }

  listDeletedPatients(startDate?: number, endDate?: number, desc?: boolean, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listDeletedPatientsWithUser(
    user: models.User,
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listDeletedPatients(startDate, endDate, desc, startDocumentId, limit)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  listDeletedPatients_2(firstName?: string, lastName?: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listDeletedPatientsByNameWithUser(user: models.User, firstName?: string, lastName?: string): Promise<Array<models.Patient> | any> {
    return super.listDeletedPatientsByName(firstName, lastName).then((rows) => this.decrypt(user, rows, false))
  }

  listOfMergesAfter(date: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listOfMergesAfterWithUser(user: models.User, date: number): Promise<Array<models.Patient> | any> {
    return super.listOfMergesAfter(date).then((pats) => this.decrypt(user, pats, false))
  }

  listOfPatientsModifiedAfter(date: number, startKey?: number, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listOfPatientsModifiedAfterWithUser(
    user: models.User,
    date: number,
    startKey?: number,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listOfPatientsModifiedAfter(date, startKey, startDocumentId, limit)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  listPatients(hcPartyId?: string, sortField?: string, startKey?: string, startDocumentId?: string, limit?: number, sortDirection?: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listPatientsWithUser(
    user: models.User,
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listPatients(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  listPatientsByHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listPatientsByHcPartyWithUser(
    user: models.User,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listPatientsByHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  listPatientsOfHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listPatientsOfHcPartyWithUser(
    user: models.User,
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listPatientsOfHcParty(hcPartyId, sortField, startKey, startDocumentId, limit, sortDirection)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  mergeInto(toId: string, fromIds: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  mergeIntoWithUser(user: models.User, toId: string, fromIds: string): Promise<models.Patient | any> {
    return super
      .mergeInto(toId, fromIds)
      .then((p) => this.decrypt(user, [p]))
      .then((pats) => pats[0])
  }

  modifyPatient(body?: models.Patient): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  modifyPatientRaw(body?: models.Patient): Promise<models.Patient | any> {
    return super.modifyPatient(body)
  }

  modifyPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | null> {
    return body
      ? this.tryEncrypt(user, [_.cloneDeep(this.completeNames(body))], false)
          .then((pats) => super.modifyPatient(pats[0]))
          .then((p) => this.decrypt(user, [p]))
          .then((pats) => {
            pats[0]?.id && this.crypto.emptyHcpCache(pats[0].id!)
            return pats[0]
          })
      : Promise.resolve(null)
  }

  modifyPatientReferral(patientId: string, referralId: string, start?: number, end?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  modifyPatientReferralWithUser(
    user: models.User,
    patientId: string,
    referralId: string,
    start?: number,
    end?: number
  ): Promise<models.Patient | any> {
    return super
      .modifyPatientReferral(patientId, referralId, start, end)
      .then((p) => this.decrypt(user, [p]))
      .then((pats) => {
        pats[0]?.id && this.crypto.emptyHcpCache(pats[0].id!)
        return pats[0]
      })
  }

  encrypt(user: models.User, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    return this.tryEncrypt(user, pats, true)
  }

  private tryEncrypt(user: models.User, pats: Array<models.Patient>, requireAccessibleKey: boolean): Promise<Array<models.Patient>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    return Promise.all(
      pats.map(async (p) => {
        const patientWithInitialisedEks =
          p.encryptionKeys && Object.values(p.encryptionKeys).some((v) => !!v.length) ? p : await this.initEncryptionKeys(user, p)
        const decryptedKeys = await this.crypto
          .extractKeysFromDelegationsForHcpHierarchy(dataOwnerId!, patientWithInitialisedEks.id!, patientWithInitialisedEks.encryptionKeys!)
          .catch((e) => {
            console.error(e)
            throw e
          })
        const fixedKeys = this.crypto.filterAndFixValidEntityEncryptionKeyStrings(decryptedKeys.extractedKeys)
        if (fixedKeys.length) {
          const key = await this.crypto.AES.importKey('raw', hex2ua(fixedKeys[0]))
          return crypt(
            patientWithInitialisedEks,
            (obj: { [key: string]: string }) =>
              this.crypto.AES.encrypt(
                key,
                utf8_2ua(
                  JSON.stringify(obj, (k, v) => {
                    return v instanceof ArrayBuffer || v instanceof Uint8Array
                      ? b2a(new Uint8Array(v).reduce((d, b) => d + String.fromCharCode(b), ''))
                      : v
                  })
                )
              ),
            this.encryptedKeys
          )
        } else if (requireAccessibleKey) {
          throw new Error(`Current data owner can't access any key of patient ${p.id}.`)
        } else {
          const cryptedCopyWithRandomKey = await crypt(
            _.cloneDeep(patientWithInitialisedEks),
            async (obj: { [key: string]: string }) => Promise.resolve(new ArrayBuffer(1)),
            this.encryptedKeys
          )
          if (
            !_.isEqual(
              _.omitBy({ ...cryptedCopyWithRandomKey, encryptedSelf: undefined }, _.isNil),
              _.omitBy({ ...patientWithInitialisedEks, encryptedSelf: undefined }, _.isNil)
            )
          ) {
            throw Error("You can't modify encrypted data of a patient if you don't have access to his encryption key.")
          }
          return patientWithInitialisedEks
        }
      })
    )
  }

  // If patient can't be decrypted returns patient with encrypted data.
  decrypt(user: models.User, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.tryDecryptOrReturnOriginal(user, patients, fillDelegations).then((ps) => ps.map((p) => p.patient))
  }

  private async tryDecryptOrReturnOriginal(
    user: models.User,
    patients: Array<models.Patient>,
    fillDelegations = true
  ): Promise<{ patient: models.Patient; decrypted: boolean }[]> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    const ids = await (user.healthcarePartyId
      ? this.hcpartyApi.getHealthcarePartyHierarchyIds(user.healthcarePartyId)
      : Promise.resolve([dataOwnerId]))

    //First check that we have no dangling delegation
    const patsWithMissingDelegations = patients.filter(
      (p) =>
        p.delegations &&
        ids.some((id) => p.delegations![id!] && !p.delegations![id!].length) &&
        !Object.values(p.delegations).some((d) => d.length > 0)
    )

    const acc: { [key: string]: models.Patient } = fillDelegations
      ? await patsWithMissingDelegations.reduce(async (acc, p) => {
          const pats = await acc
          const pat = await this.initDelegationsAndEncryptionKeys(p, user)
          const mp = await this.modifyPatientWithUser(user, pat)
          return { ...pats, [pat.id!]: mp || pat }
        }, Promise.resolve({} as { [key: string]: models.Patient }))
      : {}

    return Promise.all(
      patients
        .map((p) => acc[p.id!] || p)
        .map(async (p) => {
          const decryptedPatient = await ids.reduce(async (decP, hcpId) => {
            return (
              (await decP) ??
              (p.encryptedSelf
                ? await this.crypto
                    .extractKeysFromDelegationsForHcpHierarchy(hcpId!, p.id!, _.size(p.encryptionKeys) ? p.encryptionKeys! : p.delegations!)
                    .then(({ extractedKeys: sfks }) => {
                      sfks = this.crypto.filterAndFixValidEntityEncryptionKeyStrings(sfks)
                      if (!sfks || !sfks.length) {
                        return Promise.resolve(undefined)
                      }
                      return this.crypto.AES.importKey('raw', hex2ua(sfks[0])).then((key) =>
                        decrypt(p, (ec) =>
                          this.crypto.AES.decrypt(key, ec)
                            .then((dec) => {
                              const jsonContent = dec && ua2utf8(dec)
                              try {
                                return JSON.parse(jsonContent)
                              } catch (e) {
                                console.log('Cannot parse patient', p.id, jsonContent || 'Invalid content')
                                return Promise.resolve(undefined)
                              }
                            })
                            .catch((err) => {
                              console.log('Cannot decrypt patient', p.id, err)
                              return Promise.resolve(undefined)
                            })
                        ).then((p) => {
                          if (p.picture && !(p.picture instanceof ArrayBuffer)) {
                            p.picture = b64_2ab(p.picture)
                          }
                          return p
                        })
                      )
                    })
                : p)
            )
          }, Promise.resolve(undefined as Patient | undefined))
          return decryptedPatient ? { patient: decryptedPatient, decrypted: true } : { patient: p, decrypted: false }
        })
    )
  }

  /** By default, an encryptionKey will be added for every hcp in the autoDelegations of the provided user.
   * In optional field additionalDelegateIds, you can ask the method to create encryptionKeys for additional hcps */
  initEncryptionKeys(user: models.User, pat: models.Patient, additionalDelegateIds?: string[]): Promise<models.Patient> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    const userAutoDelegations = user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []
    return this.crypto.initEncryptionKeys(pat, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(pat.id === eks.modifiedOwner.id ? (eks.modifiedOwner as Patient) : pat, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      new Set([...userAutoDelegations, ...(additionalDelegateIds || [])]).forEach(
        (delegateId) =>
          (promise = promise.then((patient) =>
            this.crypto
              .appendEncryptionKeys(patient, dataOwnerId!, delegateId, eks.secretId)
              .then((extraEks) => {
                return _.extend(extraEks.modifiedObject, {
                  encryptionKeys: extraEks.encryptionKeys,
                })
              })
              .catch((e) => {
                console.log(e.message)
                return patient
              })
          ))
      )
      return promise
    })
  }

  share(
    user: models.User,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>,
    delegationTags: { [key: string]: Array<string> },
    usingPost: boolean = false
  ): Promise<{
    patient: models.Patient | null
    statuses: { [key: string]: { success: boolean | null; error: Error | null } }
  } | null> {
    const addDelegationsAndKeys = (
      dtos: Array<models.Form | models.Document | models.Contact | models.HealthElement | models.Classification | models.CalendarItem>,
      markerPromise: Promise<any>,
      delegateId: string,
      patient: models.Patient | null
    ) => {
      return dtos.reduce(
        (p, x) =>
          p.then(() =>
            Promise.all([this.crypto.extractDelegationsSFKs(x, ownerId), this.crypto.extractEncryptionsSKs(x, ownerId)]).then(([sfks, eks]) => {
              //console.log(`share ${x.id} to ${delegateId}`)
              return this.crypto
                .addDelegationsAndEncryptionKeys(patient, x, ownerId, delegateId, sfks.extractedKeys[0], eks.extractedKeys[0])
                .catch((e: any) => {
                  console.log(e)
                  return x
                })
            })
          ),
        markerPromise
      )
    }

    const allTags: string[] = _.uniq(_.flatMap(Object.values(delegationTags)))

    // Determine which keys to share, depending on the delegation tag. For example, anonymousMedicalData only shares encryption keys and no delegations or secret foreign keys.
    const shareDelegations: boolean = allTags.some((tag) => tag != 'anonymousMedicalInformation')
    const shareEncryptionKeys = true
    const shareCryptedForeignKeys: boolean = allTags.some((tag) => tag != 'anonymousMedicalInformation')

    // Anonymous sharing, will not change anything to the patient, only its contacts and health elements.
    const shareAnonymously: boolean = allTags.every((tag) => tag == 'anonymousMedicalInformation')

    return this.hcpartyApi.getHealthcareParty(ownerId).then((hcp) => {
      const parentId = hcp.parentId
      const status = {
        contacts: {
          success:
            allTags.includes('medicalInformation') || allTags.includes('anonymousMedicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        forms: {
          success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        healthElements: {
          success:
            allTags.includes('medicalInformation') || allTags.includes('anonymousMedicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        invoices: {
          success: allTags.includes('financialInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        documents: {
          success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        classifications: {
          success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        calendarItems: {
          success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
          error: null,
          modified: 0,
        },
        patient: { success: false, error: null, modified: 0 } as {
          success: boolean
          error: Error | null
        },
      }
      return retry(() => this.getPatientWithUser(user, patId))
        .then((patient: models.Patient) =>
          patient.encryptionKeys && Object.keys(patient.encryptionKeys || {}).length
            ? Promise.resolve(patient)
            : this.initEncryptionKeys(user, patient).then((patient: models.Patient) => this.modifyPatientWithUser(user, patient))
        )
        .then((patient: models.Patient | null) => {
          if (!patient) {
            status.patient = {
              success: false,
              error: new Error('Patient does not exist or cannot initialise encryption keys'),
            }
            return Promise.resolve({ patient: patient, statuses: status })
          }

          return this.crypto.extractDelegationsSFKsAndEncryptionSKs(patient, ownerId).then(([delSfks, ecKeys]) => {
            return delSfks.length
              ? Promise.all([
                  retry(() =>
                    (usingPost
                      ? this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, _.uniq(delSfks))
                      : this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((hes) =>
                      parentId
                        ? (usingPost
                            ? this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(parentId, _.uniq(delSfks))
                            : this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                        : hes
                    )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    (usingPost
                      ? this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, _.uniq(delSfks))
                      : this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((frms) =>
                      parentId
                        ? (usingPost
                            ? this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(parentId, _.uniq(delSfks))
                            : this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                        : frms
                    )
                  ) as Promise<Array<models.Form>>,
                  retry(() =>
                    (usingPost
                      ? this.contactApi.findByHCPartyPatientSecretFKeysUsingPost(ownerId, undefined, undefined, _.uniq(delSfks))
                      : this.contactApi.findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((ctcs) =>
                      parentId
                        ? (usingPost
                            ? this.contactApi.findByHCPartyPatientSecretFKeysUsingPost(parentId, undefined, undefined, _.uniq(delSfks))
                            : this.contactApi.findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                        : ctcs
                    )
                  ) as Promise<Array<models.Contact>>,
                  retry(() =>
                    (usingPost
                      ? this.invoiceApi.findInvoicesDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, _.uniq(delSfks))
                      : this.invoiceApi.findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((ivs) =>
                      parentId
                        ? this.invoiceApi
                            .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreIvs) => _.uniqBy(ivs.concat(moreIvs), 'id'))
                        : ivs
                    )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.classificationApi
                      .findClassificationsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                      .then((cls) =>
                        parentId
                          ? this.classificationApi
                              .findClassificationsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                              .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
                          : cls
                      )
                  ) as Promise<Array<models.Classification>>,
                  retry(() =>
                    (usingPost
                      ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(ownerId, _.uniq(delSfks))
                      : this.calendarItemApi.findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((cls) =>
                      parentId
                        ? (usingPost
                            ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(parentId, _.uniq(delSfks))
                            : this.calendarItemApi.findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
                        : cls
                    )
                  ) as Promise<Array<models.CalendarItem>>,
                ]).then(([hes, frms, ctcs, ivs, cls, cis]) => {
                  const cloneKeysAndDelegations = function (x: models.IcureStub) {
                    return {
                      delegations: shareDelegations ? _.clone(x.delegations) : undefined,
                      cryptedForeignKeys: shareCryptedForeignKeys ? _.clone(x.cryptedForeignKeys) : undefined,
                      encryptionKeys: shareEncryptionKeys ? _.clone(x.encryptionKeys) : undefined,
                    }
                  }

                  const ctcsStubs = ctcs.map((c) => ({
                    id: c.id,
                    rev: c.rev,
                    ...cloneKeysAndDelegations(c),
                  }))
                  const oHes = hes.map((x) => _.assign(new IcureStub({}), x, cloneKeysAndDelegations(x)))
                  const oFrms = frms.map((x) => _.assign(new IcureStub({}), x, cloneKeysAndDelegations(x)))
                  const oCtcsStubs = ctcsStubs.map((x) => _.assign({}, x, cloneKeysAndDelegations(x)))
                  const oIvs = ivs.map((x) => _.assign(new Invoice({}), x, cloneKeysAndDelegations(x)))
                  const oCls = cls.map((x) => _.assign(new Classification({}), x, cloneKeysAndDelegations(x)))
                  const oCis = cis.map((x) => _.assign(new CalendarItem({}), x, cloneKeysAndDelegations(x)))

                  const docIds: { [key: string]: number } = {}
                  ctcs.forEach(
                    (c: models.Contact) =>
                      c.services &&
                      c.services.forEach((s) => s.content && Object.values(s.content).forEach((c) => c && c.documentId && (docIds[c.documentId] = 1)))
                  )

                  return retry(() => this.documentApi.getDocuments(new ListOfIds({ ids: Object.keys(docIds) }))).then((docs: Array<Document>) => {
                    const oDocs = docs.map((x) => _.assign({}, x, cloneKeysAndDelegations(x)))

                    let markerPromise: Promise<any> = Promise.resolve(null)
                    delegateIds.forEach((delegateId) => {
                      const tags = delegationTags[delegateId]
                      markerPromise = markerPromise.then(() => {
                        //Share patient
                        //console.log(`share ${patient.id} to ${delegateId}`)
                        return shareAnonymously
                          ? patient
                          : this.crypto
                              .addDelegationsAndEncryptionKeys(null, patient, ownerId, delegateId, delSfks[0], ecKeys[0])
                              .then(async (patient) => {
                                if (delSfks.length > 1) {
                                  return delSfks.slice(1).reduce(async (patientPromise: Promise<models.Patient>, delSfk: string) => {
                                    const patient = await patientPromise
                                    return shareAnonymously
                                      ? patient
                                      : this.crypto
                                          .addDelegationsAndEncryptionKeys(null, patient, ownerId, delegateId, delSfk, null)
                                          .catch((e: any) => {
                                            console.log(e)
                                            return patient
                                          })
                                  }, Promise.resolve(patient))
                                }
                                return patient
                              })
                              .catch((e) => {
                                console.log(e)
                                return patient
                              })
                      })
                      ;(tags.includes('medicalInformation') || tags.includes('anonymousMedicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(hes, markerPromise, delegateId, patient))
                      ;(tags.includes('medicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(frms, markerPromise, delegateId, patient))
                      ;(tags.includes('medicalInformation') || tags.includes('anonymousMedicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(ctcsStubs, markerPromise, delegateId, patient))
                      ;(tags.includes('medicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(cls, markerPromise, delegateId, patient))
                      ;(tags.includes('medicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(cis, markerPromise, delegateId, patient))
                      ;(tags.includes('financialInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(ivs, markerPromise, delegateId, patient))
                      ;(tags.includes('medicalInformation') || tags.includes('all')) &&
                        (markerPromise = addDelegationsAndKeys(docs, markerPromise, delegateId, null))
                    })

                    return markerPromise
                      .then(() => {
                        //console.log("scd")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('anonymousMedicalInformation') || allTags.includes('all')) &&
                            ctcsStubs &&
                            ctcsStubs.length &&
                            !_.isEqual(oCtcsStubs, ctcsStubs) &&
                            this.contactApi
                              .setContactsDelegations(ctcsStubs)
                              .then(() => {
                                status.contacts.success = true
                                status.contacts.modified += ctcsStubs.length
                              })
                              .catch((e) => (status.contacts.error = e))) ||
                          Promise.resolve((status.contacts.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("shed")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('anonymousMedicalInformation') || allTags.includes('all')) &&
                            hes &&
                            hes.length &&
                            !_.isEqual(oHes, hes) &&
                            this.helementApi
                              .setHealthElementsDelegations(hes)
                              .then(() => {
                                status.healthElements.success = true
                                status.healthElements.modified += hes.length
                              })
                              .catch((e) => (status.healthElements.error = e))) ||
                          Promise.resolve((status.healthElements.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("sfd")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('all')) &&
                            frms &&
                            frms.length &&
                            !_.isEqual(oFrms, frms) &&
                            this.formApi
                              .setFormsDelegations(frms)
                              .then(() => {
                                status.forms.success = true
                                status.forms.modified += frms.length
                              })
                              .catch((e) => (status.forms.error = e))) ||
                          Promise.resolve((status.forms.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("sid")
                        return (
                          ((allTags.includes('financialInformation') || allTags.includes('all')) &&
                            ivs &&
                            ivs.length &&
                            !_.isEqual(oIvs, ivs) &&
                            this.invoiceApi
                              .setInvoicesDelegations(ivs)
                              .then(() => {
                                status.invoices.success = true
                                status.invoices.modified += ivs.length
                              })
                              .catch((e) => (status.invoices.error = e))) ||
                          Promise.resolve((status.invoices.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("sdd")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('all')) &&
                            docs &&
                            docs.length &&
                            !_.isEqual(oDocs, docs) &&
                            this.documentApi
                              .setDocumentsDelegations(docs)
                              .then(() => {
                                status.documents.success = true
                                status.documents.modified += docs.length
                              })
                              .catch((e) => (status.documents.error = e))) ||
                          Promise.resolve((status.documents.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("scld")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('all')) &&
                            cls &&
                            cls.length &&
                            !_.isEqual(oCls, cls) &&
                            this.classificationApi
                              .setClassificationsDelegations(cls)
                              .then(() => {
                                status.classifications.success = true
                                status.classifications.modified += cls.length
                              })
                              .catch((e) => (status.classifications.error = e))) ||
                          Promise.resolve((status.classifications.success = true))
                        )
                      })
                      .then(() => {
                        //console.log("scid")
                        return (
                          ((allTags.includes('medicalInformation') || allTags.includes('all')) &&
                            cis &&
                            cis.length &&
                            !_.isEqual(oCis, cis) &&
                            this.calendarItemApi
                              .setCalendarItemsDelegations(cis)
                              .then(() => {
                                status.calendarItems.success = true
                                status.calendarItems.modified += cis.length
                              })
                              .catch((e) => (status.calendarItems.error = e))) ||
                          Promise.resolve((status.calendarItems.success = true))
                        )
                      })
                      .then(() => this.modifyPatientWithUser(user, patient))
                      .then((p) => {
                        status.patient.success = true
                        console.log(
                          `c: ${status.contacts.modified}, he: ${status.healthElements.modified}, docs: ${status.documents.modified}, frms: ${status.forms.modified}, ivs: ${status.invoices.modified}, cis: ${status.calendarItems.modified}, cls: ${status.classifications.modified}`
                        )
                        return { patient: p, statuses: status }
                      })
                      .catch((e) => {
                        status.patient.error = e
                        return { patient: patient, statuses: status }
                      })
                  })
                })
              : (allTags.includes('anonymousMedicalInformation')
                  ? Promise.resolve(patient)
                  : this.modifyPatientWithUser(
                      user,
                      _.assign(patient, {
                        delegations: _.assign(
                          patient.delegations,
                          delegateIds
                            .filter((id) => !patient.delegations || !patient.delegations[id]) //If there are delegations do not modify
                            .reduce((acc, del: string) => Object.assign(acc, _.fromPairs([[del, []]])), patient.delegations || {})
                        ),
                      })
                    )
                )
                  .then((p) => {
                    status.patient.success = true
                    return { patient: p, statuses: status }
                  })
                  .catch((e) => {
                    status.patient.error = e
                    return { patient: patient, statuses: status }
                  })
          })
        })
    })
  }

  export(user: models.User, patId: string, ownerId: string, usingPost: boolean = false): Promise<{ id: string }> {
    return this.hcpartyApi.getHealthcareParty(ownerId).then((hcp) => {
      const parentId = hcp.parentId

      return retry(() => this.getPatientWithUser(user, patId))
        .then((patient: models.Patient) =>
          patient.encryptionKeys && Object.keys(patient.encryptionKeys || {}).length
            ? Promise.resolve(patient)
            : this.initEncryptionKeys(user, patient).then((patient: models.Patient) => this.modifyPatientWithUser(user, patient))
        )
        .then((patient: models.Patient | null) => {
          if (!patient) {
            return Promise.resolve({ id: patId })
          }

          return this.crypto.extractDelegationsSFKsAndEncryptionSKs(patient, ownerId).then(([delSfks, ecKeys]) => {
            return delSfks.length
              ? Promise.all([
                  retry(() =>
                    (usingPost
                      ? this.helementApi.findByHCPartyPatientSecretFKeysArray(ownerId, _.uniq(delSfks))
                      : this.helementApi.findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((hes) =>
                      parentId
                        ? this.helementApi
                            .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                        : hes
                    )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    (usingPost
                      ? this.formApi.findFormsByHCPartyPatientForeignKeysUsingPost(ownerId, undefined, undefined, undefined, _.uniq(delSfks))
                      : this.formApi.findFormsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((frms) =>
                      parentId
                        ? (usingPost
                            ? this.formApi.findFormsByHCPartyPatientForeignKeysUsingPost(parentId, undefined, undefined, undefined, _.uniq(delSfks))
                            : this.formApi.findFormsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                        : frms
                    )
                  ) as Promise<Array<models.Form>>,
                  retry(() =>
                    (usingPost
                      ? this.contactApi.findByHCPartyPatientSecretFKeysArray(ownerId, _.uniq(delSfks))
                      : this.contactApi.findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((ctcs) =>
                      parentId
                        ? (usingPost
                            ? this.contactApi.findByHCPartyPatientSecretFKeysArray(parentId, _.uniq(delSfks))
                            : this.contactApi.findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                        : ctcs
                    )
                  ) as Promise<Array<models.Contact>>,
                  retry(() =>
                    (usingPost
                      ? this.invoiceApi.findInvoicesByHCPartyPatientForeignKeysUsingPost(ownerId, _.uniq(delSfks))
                      : this.invoiceApi.findInvoicesByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    ).then((ivs) =>
                      parentId
                        ? (usingPost
                            ? this.invoiceApi.findInvoicesByHCPartyPatientForeignKeysUsingPost(parentId, _.uniq(delSfks))
                            : this.invoiceApi.findInvoicesByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                          ).then((moreIvs) => _.uniqBy(ivs.concat(moreIvs), 'id'))
                        : ivs
                    )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.classificationApi
                      .findClassificationsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                      .then((cls) =>
                        parentId
                          ? this.classificationApi
                              .findClassificationsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                              .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
                          : cls
                      )
                  ) as Promise<Array<models.Classification>>,
                  retry(async () => {
                    const delegationSFKs = _.uniq(delSfks).join(',')
                    try {
                      let calendarItems = await (usingPost
                        ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(ownerId, _.uniq(delSfks))
                        : this.calendarItemApi.findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(',')))

                      if (parentId) {
                        const moreCalendarItems = await (usingPost
                          ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(parentId, _.uniq(delSfks))
                          : this.calendarItemApi.findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(',')))
                        calendarItems = _.uniqBy(calendarItems.concat(moreCalendarItems), 'id')
                      }

                      return calendarItems
                    } catch (ex) {
                      console.log(`exception occured exporting calendarItem for ownerId: ${ownerId} - ${ex}`)
                      //throw ex
                    }
                  }) as Promise<Array<models.CalendarItem>>,
                ]).then(([hes, frms, ctcs, ivs, cls, cis]) => {
                  const docIds: { [key: string]: number } = {}
                  ctcs.forEach(
                    (c: models.Contact) =>
                      c.services &&
                      c.services.forEach((s) => s.content && Object.values(s.content).forEach((c) => c && c.documentId && (docIds[c.documentId] = 1)))
                  )

                  return retry(() => this.documentApi.getDocuments(new ListOfIds({ ids: Object.keys(docIds) }))).then((docs: Array<Document>) => {
                    return {
                      id: patId,
                      patient: patient,
                      contacts: ctcs,
                      forms: frms,
                      healthElements: hes,
                      invoices: ivs,
                      classifications: cls,
                      calItems: cis,
                      documents: docs,
                    }
                  })
                })
              : Promise.resolve({
                  id: patId,
                  patient: patient,
                  contacts: [],
                  forms: [],
                  healthElements: [],
                  invoices: [],
                  classifications: [],
                  calItems: [],
                  documents: [],
                })
          })
        })
    })
  }

  checkInami(inami: string): boolean {
    const num_inami = inami.replace(new RegExp('[^(0-9)]', 'g'), '')

    const checkDigit = num_inami.substr(6, 2)
    const numSansCheck = num_inami.substr(0, 6)
    let retour = false

    //modulo du niss
    const modINAMI = parseInt(numSansCheck) % 97

    //obtention du num de check 97 - le resultat du mod
    const checkDigit_2 = 97 - modINAMI

    if (parseInt(checkDigit) == checkDigit_2) {
      retour = true
    }
    return retour
  }

  isValidSsin(ssin: string) {
    ssin = ssin.replace(new RegExp('[^(0-9)]', 'g'), '')
    let isValidNiss = false

    const normalNumber =
      /^[0-9][0-9](([0][0-9])|([1][0-2]))(([0-2][0-9])|([3][0-1]))(([0-9]{2}[1-9])|([0-9][1-9][0-9])|([1-9][0-9]{2}))(([0-8][0-9])|([9][0-7]))$/.test(
        ssin
      )
    const bisNumber = /^[0-9][0-9](([2][0-9])|([3][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(ssin)
    const terNumber = /^[0-9][0-9](([4][0-9])|([5][0-2]))(([0-2][0-9])|([3][0-1]))[0-9]{3}(([0-8][0-9])|([9][0-7]))$/.test(ssin)

    if (normalNumber || bisNumber || terNumber) {
      isValidNiss =
        97 - (Number(ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
          ? true
          : 97 - (Number('2' + ssin.substr(0, 9)) % 97) === Number(ssin.substr(9, 2))
    }

    return isValidNiss
  }

  async getPatientIdOfChildDocumentForHcpAndHcpParents(
    childDocument: models.Invoice | models.CalendarItem | models.Contact | models.AccessLog,
    hcpId: string
  ): Promise<string> {
    const parentIdsArray = (await this.crypto.extractCryptedFKs(childDocument, hcpId)).extractedKeys

    const multipleParentIds = _.uniq(parentIdsArray).length > 1

    if (multipleParentIds) {
      throw 'Child document with id ' + childDocument.id + ' contains multiple parent ids in its CFKs for hcpId: ' + hcpId
    }

    const parentId = _.first(parentIdsArray)

    if (!parentId) {
      throw 'Parent id is empty in CFK of child document with id ' + childDocument.id + ' for hcpId: ' + hcpId
    }

    let patient: models.Patient = await super.getPatient(parentId!)

    let mergeLevel = 0
    const maxMergeLevel = 10
    while (patient.mergeToPatientId) {
      mergeLevel++
      if (mergeLevel === maxMergeLevel) {
        throw 'Too many merged levels for parent (Patient) of child document ' + childDocument.id + ' ; hcpId: ' + hcpId
      }

      patient = await super.getPatient(patient.mergeToPatientId!)
    }

    return patient.id!
  }
}
