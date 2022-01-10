import { IccPatientApi, IccEntityrefApi, IccAuthApi } from '../icc-api'
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
  Document,
  HealthcareParty,
  IcureStub,
  Invoice,
  ListOfIds,
  Patient,
  PersonName,
} from '../icc-api/model/models'
import { retry } from './utils'
import { utils } from './crypto/utils'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { b2a, hex2ua, string2ua, ua2hex, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'

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
    calendarItemaApi: IccCalendarItemXApi,
    encryptedKeys: Array<string> = ['note'],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.contactApi = contactApi
    this.formApi = formApi
    this.helementApi = helementApi
    this.invoiceApi = invoiceApi
    this.hcpartyApi = hcpartyApi
    this.documentApi = documentApi
    this.classificationApi = classificationApi
    this.calendarItemApi = calendarItemaApi

    this.encryptedKeys = encryptedKeys
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.User, p: any) {
    const patient = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Patient',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId || user.patientId,
        author: user.id,
        codes: [],
        tags: [],
      },
      p || {}
    )
    return this.initDelegations(patient, user)
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
      let officialName = findName(finalPatient, models.PersonName.UseEnum.Official)
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

  initDelegations(patient: models.Patient, user: models.User, secretForeignKey?: string): Promise<models.Patient> {
    return this.crypto
      .initObjectDelegations(patient, null, (user.healthcarePartyId || user.patientId)!, secretForeignKey || null)
      .then((initData) => {
        _.extend(patient, { delegations: initData.delegations })

        let promise = Promise.resolve(patient)
        ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
          (delegateId) =>
            (promise = promise
              .then((patient) =>
                this.crypto.extendedDelegationsAndCryptedForeignKeys(
                  patient,
                  null,
                  (user.healthcarePartyId || user.patientId)!,
                  delegateId,
                  initData.secretId
                )
              )
              .then((extraData) => _.extend(patient, { delegations: extraData.delegations }))
              .catch((e) => {
                console.log(e)
                return patient
              }))
        )
        return promise
      })
  }

  initConfidentialDelegation(patient: models.Patient, user: models.User): Promise<models.Patient | null> {
    const ownerId = user.healthcarePartyId || user.patientId
    return this.crypto.extractPreferredSfk(patient, ownerId!, true).then((k) => {
      if (!k) {
        const secretId = this.crypto.randomUuid()
        return this.crypto
          .decryptAndImportAesHcPartyKeysForDelegators([ownerId!], ownerId!)
          .then((hcPartyKeys) => {
            return this.crypto.AES.encrypt(hcPartyKeys[0].key, string2ua(patient.id + ':' + secretId).buffer as ArrayBuffer)
          })
          .then((newDelegation) => {
            ;(patient.delegations![ownerId!] || (patient.delegations![ownerId!] = [])).push(
              new Delegation({
                owner: ownerId,
                delegatedTo: ownerId,
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
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
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
      .then((p) => this.decrypt(user, [p]))
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
      ? this.encrypt(user, [_.cloneDeep(this.completeNames(body))])
          .then((pats) => super.modifyPatient(pats[0]))
          .then((p) => this.decrypt(user, [p]))
          .then((pats) => pats[0])
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
      .then((pats) => pats[0])
  }

  encrypt(user: models.User, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    return Promise.all(
      pats.map((p) =>
        (p.encryptionKeys && Object.keys(p.encryptionKeys).some((k) => !!p.encryptionKeys![k].length)
          ? Promise.resolve(p)
          : this.initEncryptionKeys(user, p)
        )
          .then((p: Patient) =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy((user.healthcarePartyId || user.patientId)!, p.id!, p.encryptionKeys!)
          )
          .then((sfks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey('raw', hex2ua(sfks.extractedKeys[0].replace(/-/g, '')))
          )
          .then((key: CryptoKey) =>
            utils.crypt(
              p,
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
          )
      )
    )
  }

  decrypt(user: models.User, pats: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return (
      user.healthcarePartyId
        ? this.hcpartyApi.getHealthcareParty(user.healthcarePartyId!).then((hcp) => [hcp.id, hcp.parentId])
        : Promise.resolve([user.patientId])
    ).then((ids) => {
      const hcpId = ids[0]
      //First check that we have no dangling delegation
      const patsWithMissingDelegations = pats.filter(
        (p) =>
          p.delegations &&
          ids.some((id) => p.delegations![id!] && !p.delegations![id!].length) &&
          !Object.values(p.delegations).some((d) => d.length > 0)
      )

      let prom: Promise<{ [key: string]: models.Patient }> = Promise.resolve({})
      fillDelegations &&
        patsWithMissingDelegations.forEach((p) => {
          prom = prom.then((acc) =>
            this.initDelegations(p, user).then((p) =>
              this.modifyPatientWithUser(user, p).then((mp) => {
                acc[p.id!] = mp || p
                return acc
              })
            )
          )
        })

      return prom
        .then((acc: { [key: string]: models.Patient }) =>
          pats.map((p) => {
            const fixedPatient = acc[p.id!]
            return fixedPatient || p
          })
        )
        .then((pats) => {
          return Promise.all(
            pats.map((p) => {
              return p.encryptedSelf
                ? this.crypto
                    .extractKeysFromDelegationsForHcpHierarchy(hcpId!, p.id!, _.size(p.encryptionKeys) ? p.encryptionKeys! : p.delegations!)
                    .then(({ extractedKeys: sfks }) => {
                      if (!sfks || !sfks.length) {
                        //console.log("Cannot decrypt contact", ctc.id)
                        return Promise.resolve(p)
                      }
                      return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, ''))).then((key) =>
                        utils
                          .decrypt(p, (ec) =>
                            this.crypto.AES.decrypt(key, ec)
                              .then((dec) => {
                                const jsonContent = dec && ua2utf8(dec)
                                try {
                                  return JSON.parse(jsonContent)
                                } catch (e) {
                                  console.log('Cannot parse patient', p.id, jsonContent || 'Invalid content')
                                  return p
                                }
                              })
                              .catch((err) => {
                                console.log('Cannot decrypt patient', p.id, err)
                                return p
                              })
                          )
                          .then((p) => {
                            if (p.picture && !(p.picture instanceof ArrayBuffer)) {
                              p.picture = b64_2ab(p.picture)
                            }
                            return p
                          })
                      )
                    })
                : Promise.resolve(p)
            })
          )
        })
    })
  }

  initEncryptionKeys(user: models.User, pat: models.Patient): Promise<models.Patient> {
    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto.initEncryptionKeys(pat, hcpId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(pat, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((patient) =>
            this.crypto
              .appendEncryptionKeys(patient, hcpId!, delegateId, eks.secretId)
              .then((extraEks) => {
                return _.extend(patient, {
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
    delegationTags: { [key: string]: Array<string> }
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
                    this.helementApi
                      .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((hes) =>
                        parentId
                          ? this.helementApi
                              .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                          : hes
                      )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.formApi
                      .findFormsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((frms) =>
                        parentId
                          ? this.formApi
                              .findFormsDelegationsStubsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                          : frms
                      )
                  ) as Promise<Array<models.Form>>,
                  retry(() =>
                    this.contactApi
                      .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(','))
                      .then((ctcs) =>
                        parentId
                          ? this.contactApi
                              .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(','))
                              .then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                          : ctcs
                      )
                  ) as Promise<Array<models.Contact>>,
                  retry(() =>
                    this.invoiceApi
                      .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((ivs) =>
                        parentId
                          ? this.invoiceApi
                              .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreIvs) => _.uniqBy(ivs.concat(moreIvs), 'id'))
                          : ivs
                      )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.classificationApi
                      .findClassificationsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((cls) =>
                        parentId
                          ? this.classificationApi
                              .findClassificationsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
                          : cls
                      )
                  ) as Promise<Array<models.Classification>>,
                  retry(() =>
                    this.calendarItemApi
                      .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(','))
                      .then((cls) =>
                        parentId
                          ? this.calendarItemApi
                              .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(','))
                              .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
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
                      c.services.forEach((s) => s.content && Object.values(s.content).forEach((c) => c.documentId && (docIds[c.documentId] = 1)))
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

  export(user: models.User, patId: string, ownerId: string): Promise<{ id: string }> {
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
                    this.helementApi
                      .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(','))
                      .then((hes) =>
                        parentId
                          ? this.helementApi
                              .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(','))
                              .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                          : hes
                      )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.formApi
                      .findFormsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((frms) =>
                        parentId
                          ? this.formApi
                              .findFormsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                          : frms
                      )
                  ) as Promise<Array<models.Form>>,
                  retry(() =>
                    this.contactApi
                      .findByHCPartyPatientSecretFKeys(ownerId, delSfks.join(','))
                      .then((ctcs) =>
                        parentId
                          ? this.contactApi
                              .findByHCPartyPatientSecretFKeys(parentId, delSfks.join(','))
                              .then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                          : ctcs
                      )
                  ) as Promise<Array<models.Contact>>,
                  retry(() =>
                    this.invoiceApi
                      .findInvoicesByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((ivs) =>
                        parentId
                          ? this.invoiceApi
                              .findInvoicesByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreIvs) => _.uniqBy(ivs.concat(moreIvs), 'id'))
                          : ivs
                      )
                  ) as Promise<Array<models.IcureStub>>,
                  retry(() =>
                    this.classificationApi
                      .findClassificationsByHCPartyPatientForeignKeys(ownerId, delSfks.join(','))
                      .then((cls) =>
                        parentId
                          ? this.classificationApi
                              .findClassificationsByHCPartyPatientForeignKeys(parentId, delSfks.join(','))
                              .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
                          : cls
                      )
                  ) as Promise<Array<models.Classification>>,
                  retry(async () => {
                    const delegationSFKs = delSfks.join(',')
                    try {
                      let calendarItems = await this.calendarItemApi.findByHCPartyPatientSecretFKeys(ownerId, delegationSFKs)

                      if (parentId) {
                        const moreCalendarItems = await this.calendarItemApi.findByHCPartyPatientSecretFKeys(parentId, delegationSFKs)
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
                      c.services.forEach((s) => s.content && Object.values(s.content).forEach((c) => c.documentId && (docIds[c.documentId] = 1)))
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
