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
import { Document, IcureStub, ListOfIds, Patient } from '../icc-api/model/models'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { retry } from './utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { EntityWithDelegationTypeName } from './utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { EntityShareOrMetadataUpdateRequest } from '../icc-api/model/requests/EntityShareOrMetadataUpdateRequest'
import { MinimalEntityBulkShareResult } from '../icc-api/model/requests/MinimalEntityBulkShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'

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

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, 'Patient'))
  }

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

  /**
   * Creates a new instance of patient with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param p initialised data for the patient. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * @return a new instance of patient.
   */
  async newInstance(
    user: models.User,
    p: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
    } = {}
  ) {
    const patient = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.Patient',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      p || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    const initialisationInfo = await this.crypto.xapi.entityWithInitialisedEncryptedMetadata(
      patient,
      'Patient',
      undefined,
      undefined,
      true,
      true,
      extraDelegations
    )
    return new models.Patient(initialisationInfo.updatedEntity)
  }

  completeNames(patient: models.Patient): models.Patient {
    let finalPatient: any = patient

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

    return new Patient(finalPatient)
  }

  /**
   * @deprecated replace with {@link initConfidentialSecretId}
   */
  async initConfidentialDelegation(patient: models.Patient, user: models.User): Promise<models.Patient> {
    return this.initConfidentialSecretId(patient, user)
  }

  /**
   * Ensures that the current data owner has some confidential secret ids for the provided patient. If not creates them and updates the patient in the
   * database.
   * @param patient the patient for which you want to initialise the confidential secret id.
   * @param user the current user.
   * @return the updated patient or the original patient if no change was necessary.
   */
  async initConfidentialSecretId(patient: models.Patient, user: models.User): Promise<models.Patient> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (dataOwnerId !== (await this.dataOwnerApi.getCurrentDataOwnerId()))
      throw new Error('You can initialise confidential delegations only for the current data owner')
    let updatedPatient = patient
    if (!patient.rev) {
      updatedPatient = await this.createPatientWithUser(user, patient)
      if (!updatedPatient) throw new Error('Could not create patient')
    }
    const initialised = await this.crypto.confidential.initialiseConfidentialSecretId(updatedPatient, 'Patient', (x) => this.bulkSharePatients(x))
    if (initialised) {
      return initialised
    } else {
      return updatedPatient
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

  getPatientWithUser(user: models.User, patientId: string): Promise<models.Patient | any> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(this.dataOwnerApi.getDataOwnerIdOf(user), [p], false))
      .then((pats) => pats[0].entity)
  }

  getPotentiallyEncryptedPatientWithUser(user: models.User, patientId: string): Promise<{ patient: models.Patient; decrypted: boolean }> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(this.dataOwnerApi.getDataOwnerIdOf(user), [p], false))
      .then((pats) => ({ patient: pats[0].entity, decrypted: pats[0].decrypted }))
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

  /**
   * @internal this method is for internal use only and may be changed without notice.
   */
  modifyPatientRaw(body?: models.Patient): Promise<models.Patient | any> {
    return super.modifyPatient(body)
  }

  modifyPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | null> {
    return body ? this.modifyPatientAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }

  private modifyPatientAs(dataOwner: string, body: models.Patient): Promise<models.Patient> {
    return this.encryptAs(dataOwner, [_.cloneDeep(this.completeNames(body))])
      .then((pats) => super.modifyPatient(pats[0]))
      .then((p) => this.decryptAs(dataOwner, [p]))
      .then((pats) => pats[0])
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
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.encryptAs(dataOwnerId, pats)
  }

  private encryptAs(dataOwner: string, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    return Promise.all(
      pats.map((p) => this.crypto.xapi.tryEncryptEntity(p, 'Patient', dataOwner, this.encryptedKeys, true, false, (x) => new models.Patient(x)))
    )
  }

  // If patient can't be decrypted returns patient with encrypted data.
  decrypt(user: models.User, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.decryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), patients, fillDelegations)
  }

  private decryptAs(dataOwner: string, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.tryDecryptOrReturnOriginal(dataOwner, patients, fillDelegations).then((ps) => ps.map((p) => p.entity))
  }

  private tryDecryptOrReturnOriginal(
    dataOwner: string,
    patients: Array<models.Patient>,
    fillDelegations = true
  ): Promise<{ entity: models.Patient; decrypted: boolean }[]> {
    return Promise.all(
      patients.map(
        async (p) =>
          await this.crypto.xapi
            .decryptEntity(p, 'Patient', dataOwner, (x) => new models.Patient(x))
            .then((p) => {
              if (p.entity.picture && !(p.entity.picture instanceof ArrayBuffer)) {
                return {
                  entity: new models.Patient({
                    ...p.entity,
                    picture: b64_2ab(p.entity.picture),
                  }),
                  decrypted: p.decrypted,
                }
              } else return p
            })
      )
    )
  }

  /**
   * @deprecated replace with {@link shareAllDataOfPatient}
   */
  async share(
    user: models.User,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>,
    delegationTags: { [key: string]: Array<string> }
  ): Promise<{
    patient: models.Patient | null
    statuses: { [key: string]: { success: boolean | null; error: Error | null } }
  } | null> {
    return this.shareAllDataOfPatient(user, patId, ownerId, delegateIds, delegationTags)
  }

  async shareAllDataOfPatient(
    user: models.User,
    patId: string,
    ownerId: string,
    delegateIds: Array<string>,
    delegationTags: { [key: string]: Array<string> }
  ): Promise<{
    patient: models.Patient | null
    statuses: { [key: string]: { success: boolean | null; error: Error | null } }
  } | null> {
    const allTags: string[] = _.uniq(_.flatMap(Object.values(delegationTags)))
    const status = {
      contacts: {
        success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
        error: null,
        modified: 0,
      },
      forms: {
        success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
        error: null,
        modified: 0,
      },
      healthElements: {
        success: allTags.includes('medicalInformation') || allTags.includes('all') ? false : null,
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
    const hcp = await this.hcpartyApi.getHealthcareParty(ownerId)
    const parentId = hcp.parentId
    let patient = await retry(() => this.getPatientWithUser(user, patId))
    const patientWithInitialisedEncryption = await this.crypto.xapi.ensureEncryptionKeysInitialised(patient, 'Patient')
    if (patientWithInitialisedEncryption) {
      patient = await this.modifyPatientWithUser(user, patientWithInitialisedEncryption)
    }

    if (!patient) {
      status.patient = {
        success: false,
        error: new Error('Patient does not exist or cannot initialise encryption keys'),
      }
      return { patient: patient, statuses: status }
    }

    const delSfks = await this.crypto.xapi.secretIdsOf({ entity: patient, type: 'Patient' }, ownerId)
    const ecKeys = await this.crypto.xapi.encryptionKeysOf({ entity: patient, type: 'Patient' }, ownerId)

    if (delSfks.length) {
      const retrievedHealthElements = await retry(() =>
        this.helementApi
          .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
          .then((hes) =>
            parentId
              ? this.helementApi
                  .findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreHes) => _.uniqBy(hes.concat(moreHes), 'id'))
              : hes
          )
      )
      const retrievedForms = await retry(() =>
        this.formApi
          .findFormsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
          .then((frms) =>
            parentId
              ? this.formApi
                  .findFormsDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreFrms) => _.uniqBy(frms.concat(moreFrms), 'id'))
              : frms
          )
      )
      const retrievedContacts = await retry(() =>
        this.contactApi
          .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
          .then((ctcs) =>
            parentId
              ? this.contactApi
                  .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreCtcs) => _.uniqBy(ctcs.concat(moreCtcs), 'id'))
              : ctcs
          )
      )
      const retrievedInvoices = await retry(() =>
        this.invoiceApi
          .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
          .then((ivs) =>
            parentId
              ? this.invoiceApi
                  .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreIvs) => _.uniqBy(ivs.concat(moreIvs), 'id'))
              : ivs
          )
      )
      const retrievedClassifications = await retry(() =>
        this.classificationApi
          .findClassificationsByHCPartyPatientForeignKeys(ownerId, _.uniq(delSfks).join(','))
          .then((cls) =>
            parentId
              ? this.classificationApi
                  .findClassificationsByHCPartyPatientForeignKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
              : cls
          )
      )
      const retrievedCalendarItems = await retry(() =>
        this.calendarItemApi
          .findByHCPartyPatientSecretFKeys(ownerId, _.uniq(delSfks).join(','))
          .then((cls) =>
            parentId
              ? this.calendarItemApi
                  .findByHCPartyPatientSecretFKeys(parentId, _.uniq(delSfks).join(','))
                  .then((moreCls) => _.uniqBy(cls.concat(moreCls), 'id'))
              : cls
          )
      )
      const isMedicalInfoTags = (tags: string[]) => tags.includes('medicalInformation') || tags.includes('all')
      const isFinancialInfoTags = (tags: string[]) => tags.includes('financialInformation') || tags.includes('all')
      const doShareEntitiesAndUpdateStatus = async (
        entities: models.IcureStub[],
        entitiesType: EntityWithDelegationTypeName,
        status: {
          success: boolean | null
          error: null | Error
          modified: number
        },
        tagsCondition: (tags: string[]) => boolean,
        doShareMinimal: (request: {
          [entityId: string]: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
        }) => Promise<MinimalEntityBulkShareResult[]>
      ): Promise<void> => {
        const delegatesToApply = delegateIds.filter((delegateId) => tagsCondition(delegationTags[delegateId]))
        if (entities.length && delegatesToApply.length) {
          const requests: {
            entity: IcureStub
            dataForDelegates: {
              [delegateId: string]: {
                shareSecretIds: string[]
                shareEncryptionKeys: string[]
                shareOwningEntityIds: string[]
                requestedPermissions: RequestedPermissionEnum
              }
            }
          }[] = []
          for (const entity of entities) {
            const currentEntityRequests: {
              [delegateId: string]: {
                shareSecretIds: string[]
                shareEncryptionKeys: string[]
                shareOwningEntityIds: string[]
                requestedPermissions: RequestedPermissionEnum
              }
            } = {}
            const secretIds = await this.crypto.xapi.secretIdsOf({ entity, type: entitiesType }, undefined)
            const encryptionKeys = await this.crypto.xapi.encryptionKeysOf({ entity, type: entitiesType }, undefined)
            const request = {
              shareSecretIds: secretIds,
              shareEncryptionKeys: encryptionKeys,
              shareOwningEntityIds: [patient.id!],
              requestedPermissions: RequestedPermissionEnum.MAX_WRITE,
            }
            for (const delegateId of delegatesToApply) {
              currentEntityRequests[delegateId] = request
            }
            requests.push({ dataForDelegates: currentEntityRequests, entity })
          }
          await this.crypto.xapi
            .bulkShareOrUpdateEncryptedEntityMetadataNoEntities(entitiesType, requests, (x) => doShareMinimal(x))
            .then((shareResult) => {
              status.modified = new Set(shareResult.successfulUpdates.map((x) => x.entityId)).size
              status.success = shareResult.updateErrors.length === 0
              if (!status.success) {
                const errorMsg = `Error while sharing (some) entities of type ${entitiesType} for patient ${patient.id} : ${JSON.stringify(
                  shareResult.updateErrors
                )}`
                console.error(errorMsg)
                status.error = new Error(errorMsg)
              }
            })
            .catch((e) => {
              status.success = false
              status.error = e
            })
        } else {
          status.success = true
        }
      }
      await doShareEntitiesAndUpdateStatus(retrievedHealthElements, 'HealthElement', status.healthElements, isMedicalInfoTags, (x) =>
        this.helementApi.bulkShareHealthElementsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedContacts, 'Contact', status.contacts, isMedicalInfoTags, (x) =>
        this.contactApi.bulkShareContactsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedInvoices, 'Invoice', status.invoices, isFinancialInfoTags, (x) =>
        this.invoiceApi.bulkShareInvoicesMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedClassifications, 'Classification', status.classifications, isMedicalInfoTags, (x) =>
        this.classificationApi.bulkShareClassificationsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedCalendarItems, 'CalendarItem', status.calendarItems, isMedicalInfoTags, (x) =>
        this.calendarItemApi.bulkShareCalendarItemsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedForms, 'Form', status.forms, isMedicalInfoTags, (x) => this.formApi.bulkShareFormsMinimal(x))
    }
    const sharePatientDataRequest = {
      shareSecretIds: delSfks,
      shareEncryptionKeys: ecKeys,
      shareOwningEntityIds: [],
      requestedPermissions: RequestedPermissionEnum.MAX_WRITE,
    }
    const sharePatientRequest = {
      entity: patient,
      dataForDelegates: Object.fromEntries(delegateIds.map((delegateId) => [delegateId, sharePatientDataRequest])),
    }
    return await this.crypto.xapi
      .bulkShareOrUpdateEncryptedEntityMetadata('Patient', [sharePatientRequest], (x) => this.bulkSharePatients(x))
      .then((shareResult) => {
        if (shareResult.updatedEntities.length && !shareResult.updateErrors.length) {
          status.patient.success = true
          return { patient: shareResult.updatedEntities[0], statuses: status }
        } else {
          const errorMsg = `Error while sharing patient with id ${patient.id} : ${JSON.stringify(shareResult.updateErrors)}`
          console.error(errorMsg)
          status.patient.error = new Error(errorMsg)
          status.patient.success = false
          return { patient: shareResult.updatedEntities[0] ?? patient, statuses: status }
        }
      })
      .catch((e) => {
        status.patient.error = e
        status.patient.success = false
        return { patient, statuses: status }
      })
  }

  export(user: models.User, patId: string, ownerId: string): Promise<{ id: string }> {
    return this.hcpartyApi.getHealthcareParty(ownerId).then((hcp) => {
      const parentId = hcp.parentId

      return retry(() => this.getPatientWithUser(user, patId))
        .then(async (patient: models.Patient) => {
          const initialised = await this.crypto.xapi.ensureEncryptionKeysInitialised(patient, 'Patient')
          if (!initialised) {
            return patient
          } else {
            return await this.modifyPatientWithUser(user, initialised)
          }
        })
        .then(async (patient: models.Patient | null) => {
          if (!patient) {
            return Promise.resolve({ id: patId })
          }
          const delSfks = await this.crypto.xapi.secretIdsOf({ entity: patient, type: 'Patient' }, ownerId)
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
    hcpId: string,
    childDocumentType: EntityWithDelegationTypeName
  ): Promise<string> {
    const parentIdsArray = await this.crypto.xapi.owningEntityIdsOf({ entity: childDocument, type: childDocumentType }, hcpId)

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

  /**
   * @return if the logged data owner has write access to the content of the given patient
   */
  async hasWriteAccess(patient: models.Patient): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: patient, type: 'Patient' })
  }

  /**
   * Share an existing patient with other data owners, allowing them to access the non-encrypted data of the patient and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the patient.
   * @param patient the patient to share.
   * @param shareSecretIds the secret ids of the Patient that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Patient is the owning entity id.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * patient does not have encrypted content.
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async shareWith(
    delegateId: string,
    patient: models.Patient,
    shareSecretIds: string[],
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<ShareResult<models.Patient>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(patient, 'Patient')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyPatientAs(self, entityWithEncryptionKey) : patient
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        { entity: updatedEntity, type: 'Patient' },
        delegateId,
        options?.shareEncryptionKey,
        ShareMetadataBehaviour.NEVER,
        shareSecretIds,
        options.requestedPermissions ?? RequestedPermissionEnum.MAX_WRITE,
        (x) => this.bulkSharePatients(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decryptAs(self, [e]).then((es) => es[0])))
  }

  /**
   * @param patient a patient
   * @return all the decryptable secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  getSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: patient, type: 'Patient' }, undefined)
  }

  /**
   * @param patient a patient
   * @return the confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  getConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.confidential.getConfidentialSecretIds({ entity: patient, type: 'Patient' }, undefined)
  }

  /**
   * @param patient a patient
   * @return the non-confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  getNonConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.confidential.getSecretIdsSharedWithParents({ entity: patient, type: 'Patient' })
  }
}
