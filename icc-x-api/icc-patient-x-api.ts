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
import { CalendarItem, Classification, Document, IcureStub, Invoice, ListOfIds, Patient } from '../icc-api/model/models'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { retry } from './utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends IccPatientApi implements EncryptedEntityXApi<models.Patient> {
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

  /**
   * Creates a new instance of patient with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param p initialised data for the patient. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * @return a new instance of patient.
   */
  async newInstance(
    user: models.User,
    p: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
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
    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(user.autoDelegations?.all ?? []),
      ...(user.autoDelegations?.medicalInformation ?? []),
    ]
    const initialisationInfo = await this.crypto.entities.entityWithInitialisedEncryptedMetadata(
      patient,
      undefined,
      undefined,
      true,
      extraDelegations
    )
    return new models.Patient(initialisationInfo.updatedEntity)
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
    const initialised = await this.crypto.confidential.entityWithInitialisedConfidentialSecretId(patient)
    if (initialised) {
      return initialised.rev ? this.modifyPatientWithUser(user, initialised) : this.createPatientWithUser(user, initialised)
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

  getPatientWithUser(user: models.User, patientId: string): Promise<models.Patient | any> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(this.dataOwnerApi.getDataOwnerIdOf(user), [p]))
      .then((pats) => pats[0].entity)
  }

  getPotentiallyEncryptedPatientWithUser(user: models.User, patientId: string): Promise<{ patient: models.Patient; decrypted: boolean }> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal(this.dataOwnerApi.getDataOwnerIdOf(user), [p]))
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

  modifyPatientRaw(body?: models.Patient): Promise<models.Patient | any> {
    return super.modifyPatient(body)
  }

  modifyPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | null> {
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }

  modifyAs(dataOwner: string, body: models.Patient): Promise<models.Patient> {
    return this.encryptAs(dataOwner, [_.cloneDeep(this.completeNames(body))])
      .then((pats) => super.modifyPatient(pats[0]))
      .then((p) => this.tryDecryptOrReturnOriginal(dataOwner, [p]))
      .then((pats) => pats[0].entity)
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
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), pats)
  }

  private encryptAs(dataOwnerId: string | undefined, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    return Promise.all(
      pats.map((p) => this.crypto.entities.tryEncryptEntity(p, dataOwnerId, this.encryptedKeys, true, false, (x) => new models.Patient(x)))
    )
  }

  // If patient can't be decrypted returns patient with encrypted data.
  decrypt(user: models.User, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.tryDecryptOrReturnOriginal(this.dataOwnerApi.getDataOwnerIdOf(user), patients).then((ps) => ps.map((p) => p.entity))
  }

  tryDecryptOrReturnOriginal(
    dataOwnerId: string | undefined,
    patients: Array<models.Patient>
  ): Promise<{ entity: models.Patient; decrypted: boolean }[]> {
    return Promise.all(
      patients.map(
        async (p) =>
          await this.crypto.entities
            .decryptEntity(p, dataOwnerId, (x) => new models.Patient(x))
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
          p.then(async () => {
            const secretIds = await this.crypto.entities.secretIdsOf(x, ownerId)
            const encryptionKeys = await this.crypto.entities.encryptionKeysOf(x, ownerId)
            const parentIds = await this.crypto.entities.owningEntityIdsOf(x, ownerId)
            const updatedX = await this.crypto.entities
              .entityWithExtendedEncryptedMetadata(x, delegateId, secretIds, encryptionKeys, parentIds, [])
              .catch((e: any) => {
                console.log(e)
                return x
              })
            _.assign(x, updatedX)
            return x
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
                    markerPromise = markerPromise.then(async () => {
                      //Share patient
                      const updatedPatient = await this.crypto.entities
                        .entityWithExtendedEncryptedMetadata(patient, delegateId, delSfks, ecKeys, [], [])
                        .catch((e) => {
                          console.log(e)
                          return patient
                        })
                      return _.assign(patient, updatedPatient)
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

  export(user: models.User, patId: string, ownerId: string, usingPost: boolean = false): Promise<{ id: string }> {
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
          return Promise.resolve().then(() => {
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
    const parentIdsArray = await this.crypto.entities.owningEntityIdsOf(childDocument, hcpId)

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
   * Share an existing patient with other data owners, allowing them to access the non-encrypted data of the patient and optionally also
   * the encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the patient.
   * @param patient the patient to share.
   * @param shareSecretIds the secret ids of the Patient that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Patient is the owning entity id.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * patient does not have encrypted content.
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated patient.
   */
  async shareWith(
    delegateId: string,
    patient: models.Patient,
    shareSecretIds: string[],
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Patient> {
    return this.shareWithMany(patient, { [delegateId]: { shareSecretIds, ...options } })
  }

  /**
   * Share an existing patient with other data owners, allowing them to access the non-encrypted data of the patient and optionally also
   * the encrypted content.
   * @param patient the patient to share.
   * @param delegates sharing options for each delegate.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * patient does not have encrypted content.
   * - shareSecretIds the secret ids of the Patient that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Patient is the owning entity id.
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated patient.
   */
  async shareWithMany(
    patient: models.Patient,
    delegates: {
      [delegateId: string]: {
        shareSecretIds: string[]
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Patient> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    return await this.modifyAs(self, await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(patient, false, delegates))
  }

  /**
   * @param patient a patient
   * @return all the decryptable secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.entities.secretIdsOf(patient, undefined)
  }

  /**
   * @param patient a patient
   * @return the confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.confidential.getConfidentialSecretIds(patient, undefined)
  }

  /**
   * @param patient a patient
   * @return the non-confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptNonConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.confidential.getSecretIdsSharedWithParents(patient)
  }

  async getDataOwnersWithAccessTo(
    entity: models.Patient
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: 'WRITE' }; hasUnknownAnonymousDataOwners: boolean }> {
    return await this.crypto.entities.getDataOwnersWithAccessTo(entity)
  }

  async getEncryptionKeysOf(entity: models.Patient): Promise<string[]> {
    return await this.crypto.entities.encryptionKeysOf(entity)
  }

  /**
   * Merge two patients into one. This method performs the following operations:
   * - The `from` patient will be soft-deleted, and it will point to the `into` patient. Only the `deletionDate` and `mergeToPatientId` fields of the
   *   patient will be changed (automatically by this method). Note that the value of {@link from} is only used to verify that the client is aware of
   *   the last version of the `from` patient: any changes to its content and/or metadata compared to what is actually stored in the database will be
   *   ignored.
   * - The metadata of the `into` patient will be automatically updated to contain also the metadata of the `from` patient and to keep track of the
   *   merge:
   *   - the `mergedIds` will be updated to contain the `from` patient id
   *   - all secret ids of the `from` patient will be added to the `into` patient
   *   - all data owners (including anonymous data owners) with access to the `from` patient will have the same access to the merged `into` patient
   *     (unless they already had greater access to the `into` patient, in which case they keep the greater access)
   * - The content of the `into` patient will be updated to match the content (name, address, note, ...) of the provided {@link mergedInto} parameter.
   *   Note that since the metadata is automatically updated by this method you must not change the metadata of the `mergedInto` patient
   *   (`delegations`, mergedInto`, ...): if there is any change between the metadata of the provided `mergedInto` patient and the stored patient this
   *   method will fail with an error.
   *
   * In case the revisions of {@link from} and/or {@link mergedInto} does not match the latest revisions for these patients in the database this
   * method will fail without soft-deleting the `from` patient and without updating the `into` patient with the merged content and metadata. You will
   * have to retrieve the updated versions of both patients before retrying the merge.
   *
   * Finally, note that this method only merges existing data, and does not perform any automatic sharing of the data. The secret ids and encryption
   * keys will not be shared with users that had access only to one of the entity, you will have to use the {@link shareWith} method after the merge
   * if you want to do so.
   * For example consider hcps A, B with access to P' and hcps A, C with access to P'', and we merge P'' into P'. After the merge:
   * - A has access to all secret ids of the merged patient and to the encryption key of the merged patient
   * - B has access to the encryption key of the merged patient (since it is the same as in P'), but only to the secret id which was originally from
   *   the unmerged P'
   * - C has no access to the encryption key of the merged patient, and has access only to the secret id which was originally from the unmerged P''
   *
   * @param from the original, unmodified `from` patient. Its content will be unchanged and its metadata will be automatically updated by this method
   * to reflect the merge.
   * @param mergedInto the `into` patient with updated content result of the merge with the `from` patient, as specified by your application logic.
   * The metadata of the `mergedInto` patient must not differ from the metadata of the stored version of the patient, since it will be automatically
   * updated by the method.
   * @return the updated `into` patient.
   */
  async mergePatients(from: Patient, mergedInto: Patient): Promise<Patient> {
    const encryptedMerged = (await this.encryptAs(undefined, [mergedInto]))[0]
    const merged = await super.baseMergePatients(from.id!, from.rev!, encryptedMerged)
    return (await this.tryDecryptOrReturnOriginal(undefined, [merged]))[0].entity
  }
}
