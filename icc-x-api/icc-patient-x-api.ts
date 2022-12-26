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
import { CalendarItem, Classification, Delegation, Document, IcureStub, Invoice, ListOfIds, Patient } from '../icc-api/model/models'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { b2a, hex2ua, string2ua, ua2hex, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { crypt, decrypt, retry } from './utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider } from './auth/AuthenticationProvider'

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
    authenticationProvider: AuthenticationProvider,
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
  async newInstance(user: models.User, p: any = {}, delegates: string[] = [], delegationTags?: string[]) {
    const patient = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
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

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    const initialisationInfo = await this.crypto.entities.entityWithInitialisedEncryptedMetadata(
      patient,
      undefined,
      undefined,
      true,
      extraDelegations,
      delegationTags
    )
    const anonymousDelegations = user.autoDelegations?.anonymousMedicalInformation ?? []
    return new models.Patient(
      await anonymousDelegations.reduce(
        async (updatedContact, delegate) =>
          await this.crypto.entities.entityWithSharedEncryptedMetadata(
            await updatedContact,
            delegate,
            false,
            [initialisationInfo.rawEncryptionKey!],
            false,
            [] // TODO No tags for who uses anonymous info?
          ),
        Promise.resolve(initialisationInfo.updatedEntity)
      )
    )
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

  /**
   * @deprecated The concept of confidential will be removed from the iCure API: this method will be removed from the general purpose iCure api.
   * After instantiating a new patient use {@link EntitiesEncryption.entityWithSharedEncryptedMetadata} as shown here to create a new confidential delegation.
   */
  async initConfidentialDelegation(patient: models.Patient, user: models.User): Promise<models.Patient> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)
    const confidentialDelegation = await this.crypto.extractPreferredSfk(patient, dataOwnerId!, true)
    if (!confidentialDelegation) {
      const confidentialSecretId = this.crypto.primitives.randomUuid()
      const updatedPatient = await this.crypto.entities.entityWithSharedEncryptedMetadata(
        patient,
        dataOwnerId,
        [confidentialSecretId],
        false,
        false,
        ['confidential']
      )
      return updatedPatient.rev ? this.modifyPatientWithUser(user, updatedPatient) : this.createPatientWithUser(user, updatedPatient)
    } else {
      return patient
    }
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

  getPatientWithUser(user: models.User, patientId: string): Promise<models.Patient> {
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
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return Promise.all(pats.map((p) => this.crypto.entities.encryptEntity(p, dataOwnerId, this.encryptedKeys, true, (x) => new models.Patient(x))))
  }

  decrypt(user: models.User, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return (user.healthcarePartyId ? this.hcpartyApi.getHealthcarePartyHierarchyIds(user.healthcarePartyId) : Promise.resolve([dataOwnerId])).then(
      async (ids) => {
        // TODO why the check of dangling delegations only for patients
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
              const pat = (await this.crypto.entities.entityWithInitialisedEncryptedMetadata(p, undefined, undefined, true, [], [])).updatedEntity
              const mp = await this.modifyPatientWithUser(user, pat)
              return { ...pats, [pat.id!]: mp || pat }
            }, Promise.resolve({} as { [key: string]: models.Patient }))
          : {}

        return Promise.all(
          patients
            .map((p) => acc[p.id!] || p)
            .map(async (p): Promise<Patient> => {
              return (
                (await ids.reduce(async (decP, hcpId) => {
                  return (
                    (await decP) ??
                    (p.encryptedSelf
                      ? await this.crypto.entities
                          .decryptEntity(p, hcpId, (x) => new models.Patient(x))
                          .then((p) => {
                            if (p.picture && !(p.picture instanceof ArrayBuffer)) {
                              return new models.Patient({
                                ...p,
                                picture: b64_2ab(p.picture),
                              })
                            } else return p
                          })
                      : p)
                  )
                }, Promise.resolve(undefined as Patient | undefined))) ?? p
              )
            })
        )
      }
    )
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
          p.then(async () => {
            const secretIds = await this.crypto.entities.secretIdsOf(x, ownerId)
            const encryptionKeys = await this.crypto.entities.encryptionKeysOf(x, ownerId)
            const parentIds = await this.crypto.entities.parentIdsOf(x, ownerId)
            return this.crypto.entities.entityWithSharedEncryptedMetadata(x, delegateId, secretIds, encryptionKeys, parentIds, []).catch((e: any) => {
              console.log(e)
              return x
            })
          }),
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
            : this.crypto.entities
                .ensureEncryptionKeysInitialised(patient)
                .then((patient: models.Patient) => this.modifyPatientWithUser(user, patient))
        )
        .then(async (patient: models.Patient | null) => {
          if (!patient) {
            status.patient = {
              success: false,
              error: new Error('Patient does not exist or cannot initialise encryption keys'),
            }
            return Promise.resolve({ patient: patient, statuses: status })
          }

          const delSfks = await this.crypto.entities.secretIdsOf(patient, ownerId)
          const ecKeys = await this.crypto.entities.encryptionKeysOf(patient, ownerId)
          return delSfks.length
            ? Promise.all([
                retry(() =>
                  this.helementApi
                    .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((hes) =>
                      parentId
                        ? this.helementApi
                            .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                        : hes
                    )
                ) as Promise<Array<models.IcureStub>>,
                retry(() =>
                  this.formApi
                    .findFormsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((frms) =>
                      parentId
                        ? this.formApi
                            .findFormsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                        : frms
                    )
                ) as Promise<Array<models.Form>>,
                retry(() =>
                  this.contactApi
                    .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((ctcs) =>
                      parentId
                        ? this.contactApi
                            .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                        : ctcs
                    )
                ) as Promise<Array<models.Contact>>,
                retry(() =>
                  this.invoiceApi
                    .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((ivs) =>
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
                  this.calendarItemApi
                    .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((cls) =>
                      parentId
                        ? this.calendarItemApi
                            .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
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
                        : this.crypto.entities.entityWithSharedEncryptedMetadata(patient, delegateId, delSfks, ecKeys, false, []).catch((e) => {
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
  }

  export(user: models.User, patId: string, ownerId: string): Promise<{ id: string }> {
    return this.hcpartyApi.getHealthcareParty(ownerId).then((hcp) => {
      const parentId = hcp.parentId

      return retry(() => this.getPatientWithUser(user, patId))
        .then((patient: models.Patient) =>
          patient.encryptionKeys && Object.keys(patient.encryptionKeys || {}).length
            ? Promise.resolve(patient)
            : this.crypto.entities
                .ensureEncryptionKeysInitialised(patient)
                .then((patient: models.Patient) => this.modifyPatientWithUser(user, patient))
        )
        .then(async (patient: models.Patient | null) => {
          if (!patient) {
            return Promise.resolve({ id: patId })
          }
          const delSfks = await this.crypto.entities.secretIdsOf(patient, ownerId)
          const ecKeys = await this.crypto.entities.encryptionKeysOf(patient, ownerId)
          return delSfks.length
            ? Promise.all([
                retry(() =>
                  this.helementApi
                    .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((hes) =>
                      parentId
                        ? this.helementApi
                            .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
                        : hes
                    )
                ) as Promise<Array<models.IcureStub>>,
                retry(() =>
                  this.formApi
                    .findFormsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((frms) =>
                      parentId
                        ? this.formApi
                            .findFormsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
                        : frms
                    )
                ) as Promise<Array<models.Form>>,
                retry(() =>
                  this.contactApi
                    .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((ctcs) =>
                      parentId
                        ? this.contactApi
                            .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                            .then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
                        : ctcs
                    )
                ) as Promise<Array<models.Contact>>,
                retry(() =>
                  this.invoiceApi
                    .findInvoicesByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
                    .then((ivs) =>
                      parentId
                        ? this.invoiceApi
                            .findInvoicesByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
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
                retry(async () => {
                  const delegationSFKs = _.uniq(delSfks).join(',')
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
  }

  checkInami(inami: string): boolean {
    const num_inami = inami.replace(new RegExp('[^(0-9)]', 'g'), '')

    const checkDigit = num_inami.substring(6, 2)
    const numSansCheck = num_inami.substring(0, 6)
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
        97 - (Number(ssin.substring(0, 9)) % 97) === Number(ssin.substring(9, 2))
          ? true
          : 97 - (Number('2' + ssin.substring(0, 9)) % 97) === Number(ssin.substring(9, 2))
    }

    return isValidNiss
  }

  async getPatientIdOfChildDocumentForHcpAndHcpParents(
    childDocument: models.Invoice | models.CalendarItem | models.Contact | models.AccessLog,
    hcpId: string
  ): Promise<string> {
    const parentIdsArray = await this.crypto.entities.parentIdsOf(childDocument, hcpId)

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
