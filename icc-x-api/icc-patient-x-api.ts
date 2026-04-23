import { IccAuthApi, IccPatientApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccContactXApi } from './icc-contact-x-api'
import { IccFormXApi } from './icc-form-x-api'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { IccInvoiceXApi } from './icc-invoice-x-api'
import { IccDocumentXApi } from './icc-document-x-api'
import { IccHelementXApi } from './icc-helement-x-api'
import { IccClassificationXApi } from './icc-classification-x-api'

import { cloneDeep, uniqBy } from './utils/collection-utils'
import * as models from '../icc-api/model/models'
import { Document, IcureStub, ListOfIds, MaintenanceTask, Patient, TimingInfo } from '../icc-api/model/models'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { b64_2ab } from '../icc-api/model/ModelHelper'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { EncryptedFieldsManifest, parseEncryptedFields, retry, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { EntityWithDelegationTypeName } from './utils/EntityWithDelegationTypeName'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { MinimalEntityBulkShareResult } from '../icc-api/model/requests/MinimalEntityBulkShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { IccUserXApi } from './icc-user-x-api'
import { AbstractFilter } from './filters/filters'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { BulkShareOrUpdateMetadataParams } from '../icc-api/model/requests/BulkShareOrUpdateMetadataParams'

// noinspection JSUnusedGlobalSymbols
export class IccPatientXApi extends IccPatientApi implements EncryptedEntityXApi<models.Patient> {
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.Patient))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly contactApi: IccContactXApi,
    private readonly formApi: IccFormXApi,
    private readonly helementApi: IccHelementXApi,
    private readonly invoiceApi: IccInvoiceXApi,
    private readonly documentApi: IccDocumentXApi,
    private readonly hcpartyApi: IccHcpartyXApi,
    private readonly classificationApi: IccClassificationXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly calendarItemApi: IccCalendarItemXApi,
    private readonly userApi: IccUserXApi,
    private readonly authApi: IccAuthApi,
    private readonly autofillAuthor: boolean,
    encryptedKeys: Array<string> = ['note'],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)

    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'Patient.')
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
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of patient.
   */
  async newInstance(
    user: models.User,
    p: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ) {
    const patient = {
      ...(p ?? {}),
      _type: 'org.taktik.icure.entities.Patient',
      id: p?.id ?? this.crypto.primitives.randomUuid(),
      created: p?.created ?? new Date().getTime(),
      modified: p?.modified ?? new Date().getTime(),
      responsible: p?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: p?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: p?.codes ?? [],
      tags: p?.tags ?? [],
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
          )),
      ...(options?.additionalDelegates ?? {}),
    }
    const initialisationInfo = await this.crypto.xapi.entityWithInitialisedEncryptedMetadata(
      patient,
      EntityWithDelegationTypeName.Patient,
      undefined,
      undefined,
      true,
      extraDelegations,
      options.alternateRootDelegation
    )
    return new models.Patient(initialisationInfo.updatedEntity)
  }

  /**
   * Ensures patient names are consistent by synchronizing names property with firstName/lastName/maidenName/alias fields.
   * @param patient the patient to process
   * @return the patient with completed names
   */
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
    const initialised = await this.crypto.xapi.initialiseConfidentialSecretId(updatedPatient, EntityWithDelegationTypeName.Patient, (x) =>
      this.bulkSharePatients(x)
    )
    if (initialised) {
      return initialised
    } else {
      return updatedPatient
    }
  }

  createPatient(body?: models.Patient): never {
    throw new Error('Cannot call a method that returns patients without providing a user for de/encryption')
  }

  /**
   * Creates a patient in the database with encryption.
   * @param user the current user
   * @param body the patient data to create
   * @return the created patient
   */
  createPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | any> {
    return body
      ? this.encrypt(user, [cloneDeep(this.completeNames(body))])
          .then((pats) => super.createPatient(pats[0]))
          .then(async (patient: Patient) => {
            /**
             * This code is a workaround for the fact that the backend is adding empty delegations to the patient when it is created.
             */

            const patientDelegations = patient.delegations

            if (patientDelegations != undefined && Object.keys(patientDelegations).length > 0) {
              const areDelegationsEmpty = Object.values(patientDelegations).every((delegation) => delegation.length === 0)

              if (areDelegationsEmpty) {
                return await this.modifyPatientRaw(
                  new Patient({
                    ...patient,
                    delegations: {},
                  })
                )
              }
            }
            return patient
          })
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

  /**
   * Filters patients using a filter chain and returns decrypted results.
   * @param user the current user
   * @param filterChain the filter chain to apply
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @param skip optional number of results to skip
   * @param sort optional sort field
   * @param desc optional sort direction
   * @param collectTiming add timing information to the response
   * @return paginated list of decrypted patients
   */
  filterByWithUser(
    user: models.User,
    filterChain: models.FilterChainPatient,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    collectTiming?: false
  ): Promise<models.PaginatedListPatient | any>
  filterByWithUser(
    user: models.User,
    filterChain: models.FilterChainPatient,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    collectTiming?: true
  ): Promise<(models.PaginatedListPatient & TimingInfo) | any>
  filterByWithUser(
    user: models.User,
    filterChain: models.FilterChainPatient,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    collectTiming: boolean = false
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .filterPatientsBy(startKey, startDocumentId, limit, skip, sort, desc, filterChain, collectTiming as any)
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

  /**
   * Finds patients by access log user after a specific date and returns decrypted results.
   * @param user the current user
   * @param userId the user id to search for in access logs
   * @param accessType optional type of access
   * @param startDate optional start date timestamp
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @return paginated list of decrypted patients
   */
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

  /**
   * Finds a patient by external id and returns the decrypted result.
   * @param user the current user
   * @param externalId the external id to search for
   * @return the decrypted patient
   */
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

  /**
   * Finds patients by name, birth date, or SSIN with automatic search and returns decrypted results.
   * @param user the current user
   * @param healthcarePartyId optional healthcare party id
   * @param filterValue optional search value
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @param sortDirection optional sort direction
   * @return paginated list of decrypted patients
   */
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

  /**
   * Performs a fuzzy search for patients and returns decrypted results.
   * @param user the current user
   * @param firstName optional first name to search for
   * @param lastName optional last name to search for
   * @param dateOfBirth optional date of birth timestamp
   * @return array of decrypted patients
   */
  fuzzySearchWithUser(user: models.User, firstName?: string, lastName?: string, dateOfBirth?: number): Promise<Array<models.Patient> | any> {
    return super.fuzzySearch(firstName, lastName, dateOfBirth).then((pats) => this.decrypt(user, pats))
  }

  getPatient(patientId: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Gets a patient by id without decryption.
   * @param patientId the patient id
   * @return the encrypted patient
   */
  getPatientRaw(patientId: string): Promise<models.Patient | any> {
    return super.getPatient(patientId)
  }

  /**
   * Gets a patient by id with decryption.
   * @param user the current user
   * @param patientId the patient id
   * @return the decrypted patient
   */
  getPatientWithUser(user: models.User, patientId: string): Promise<models.Patient | any> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal([p]))
      .then((pats) => pats[0].entity)
  }

  /**
   * Gets a patient by id and indicates whether it was successfully decrypted.
   * @param user the current user
   * @param patientId the patient id
   * @return object containing the patient and a flag indicating if it was decrypted
   */
  getPotentiallyEncryptedPatientWithUser(user: models.User, patientId: string): Promise<{ patient: models.Patient; decrypted: boolean }> {
    return super
      .getPatient(patientId)
      .then((p) => this.tryDecryptOrReturnOriginal([p]))
      .then((pats) => ({ patient: pats[0].entity, decrypted: pats[0].decrypted }))
  }

  getPatients(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Gets multiple patients by their ids with decryption.
   * @param user the current user
   * @param body list of patient ids
   * @return array of decrypted patients
   */
  getPatientsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<models.Patient> | any> {
    return super.getPatients(body).then((pats) => this.decrypt(user, pats))
  }

  listDeletedPatients(startDate?: number, endDate?: number, desc?: boolean, startKey?: string, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Lists deleted patients with decryption.
   * @param user the current user
   * @param startDate optional start date timestamp
   * @param endDate optional end date timestamp
   * @param desc optional sort direction
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @return paginated list of decrypted deleted patients
   */
  listDeletedPatientsWithUser(
    user: models.User,
    startDate?: number,
    endDate?: number,
    desc?: boolean,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.PaginatedListPatient | any> {
    return super
      .listDeletedPatients(startDate, endDate, desc, startDocumentId, startKey, limit)
      .then((pl) => this.decrypt(user, pl.rows!, false).then((dr) => Object.assign(pl, { rows: dr })))
  }

  listDeletedPatients_2(firstName?: string, lastName?: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Lists deleted patients by name with decryption.
   * @param user the current user
   * @param firstName optional first name to filter by
   * @param lastName optional last name to filter by
   * @return array of decrypted deleted patients
   */
  listDeletedPatientsByNameWithUser(user: models.User, firstName?: string, lastName?: string): Promise<Array<models.Patient> | any> {
    return super.listDeletedPatientsByName(firstName, lastName).then((rows) => this.decrypt(user, rows, false))
  }

  listOfMergesAfter(date: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Lists merged patients after a specific date with decryption.
   * @param user the current user
   * @param date timestamp to start from
   * @return array of decrypted merged patients
   */
  listOfMergesAfterWithUser(user: models.User, date: number): Promise<Array<models.Patient> | any> {
    return super.listOfMergesAfter(date).then((pats) => this.decrypt(user, pats, false))
  }

  listOfPatientsModifiedAfter(date: number, startKey?: number, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Lists patients modified after a specific date with decryption.
   * @param user the current user
   * @param date timestamp to start from
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @return paginated list of decrypted modified patients
   */
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

  /**
   * Lists patients with decryption.
   * @param user the current user
   * @param hcPartyId optional healthcare party id
   * @param sortField optional sort field
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @param sortDirection optional sort direction
   * @return paginated list of decrypted patients
   */
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

  /**
   * Lists patients by healthcare party with decryption.
   * @param user the current user
   * @param hcPartyId the healthcare party id
   * @param sortField optional sort field
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @param sortDirection optional sort direction
   * @return paginated list of decrypted patients
   */
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

  /**
   * Lists patients of a healthcare party with decryption.
   * @param user the current user
   * @param hcPartyId the healthcare party id
   * @param sortField optional sort field
   * @param startKey optional start key for pagination
   * @param startDocumentId optional start document id for pagination
   * @param limit optional maximum number of results
   * @param sortDirection optional sort direction
   * @return paginated list of decrypted patients
   */
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

  /**
   * Merges patients and returns the decrypted result.
   * @param user the current user
   * @param toId the target patient id
   * @param fromIds the source patient ids to merge from
   * @return the decrypted merged patient
   */
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

  /**
   * Updates a patient with encryption.
   * @param user the current user
   * @param body the patient data to update
   * @return the updated decrypted patient
   */
  modifyPatientWithUser(user: models.User, body?: models.Patient): Promise<models.Patient | null> {
    return body ? this.modifyPatientAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }

  private modifyPatientAs(dataOwner: string, body: models.Patient): Promise<models.Patient> {
    return this.encryptAs(dataOwner, [cloneDeep(this.completeNames(body))])
      .then((pats) => super.modifyPatient(pats[0]))
      .then((p) => this.decryptAs(dataOwner, [p]))
      .then((pats) => pats[0])
  }

  modifyPatientReferral(patientId: string, referralId: string, start?: number, end?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  /**
   * Updates a patient referral and returns the decrypted result.
   * @param user the current user
   * @param patientId the patient id
   * @param referralId the referral id
   * @param start optional start timestamp
   * @param end optional end timestamp
   * @return the updated decrypted patient
   */
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

  /**
   * Encrypts patients using the current user's encryption keys.
   * @param user the current user
   * @param pats the patients to encrypt
   * @return the encrypted patients
   */
  encrypt(user: models.User, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.encryptAs(dataOwnerId, pats)
  }

  private encryptAs(dataOwner: string, pats: Array<models.Patient>): Promise<Array<models.Patient>> {
    return this.crypto.xapi.tryEncryptEntities(
      pats,
      EntityWithDelegationTypeName.Patient,
      this.encryptedFields,
      true,
      false,
      (x) => new models.Patient(x)
    )
  }

  /**
   * Decrypts patients using the current user's encryption keys. If a patient can't be decrypted, returns it with encrypted data.
   * @param user the current user
   * @param patients the patients to decrypt
   * @param fillDelegations optional flag to fill delegations (defaults to true)
   * @return the decrypted patients
   */
  decrypt(user: models.User, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.decryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), patients, fillDelegations)
  }

  private decryptAs(dataOwner: string, patients: Array<models.Patient>, fillDelegations = true): Promise<Array<models.Patient>> {
    return this.tryDecryptOrReturnOriginal(patients).then((ps) => ps.map((p) => p.entity))
  }

  /**
   * Attempts to decrypt patients. If decryption fails, returns the original encrypted patients.
   * @param patients the patients to decrypt
   * @return array of objects containing the patient entity and a flag indicating if it was decrypted
   */
  async tryDecryptOrReturnOriginal(patients: Array<models.Patient>): Promise<{ entity: models.Patient; decrypted: boolean }[]> {
    return (await this.crypto.xapi.tryDecryptEntities(patients, EntityWithDelegationTypeName.Patient, (x) => new models.Patient(x))).map((p) => {
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
  }

  /**
   * @deprecated replace with {@link shareAllDataOfPatient}
   */
  async share(
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
    return this.shareAllDataOfPatient(user, patId, ownerId, delegateIds, delegationTags, usingPost)
  }

  /**
   * Shares a patient and all related data with specified delegates.
   * @param user the current user
   * @param patId the patient id
   * @param ownerId the owner healthcare party id
   * @param delegateIds the delegate ids to share with
   * @param delegationTags tags specifying what data to share (e.g., medicalInformation, financialInformation, all)
   * @param usingPost optional flag to use POST method instead of GET (defaults to false)
   * @return object containing the updated patient and sharing statuses for each entity type
   */
  async shareAllDataOfPatient(
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
    const allTags: string[] = [...new Set(Object.values(delegationTags).flat())]
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
    const patientWithInitialisedEncryption = await this.crypto.xapi.ensureEncryptionKeysInitialised(patient, EntityWithDelegationTypeName.Patient)
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

    const delSfks = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, ownerId)
    const ecKeys = await this.crypto.xapi.encryptionKeysOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, ownerId)

    if (delSfks.length) {
      const retrievedHealthElements = await retry(() =>
        (usingPost
          ? this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, [...new Set(delSfks)])
          : this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, [...new Set(delSfks)].join(','))
        ).then((hes) =>
          parentId
            ? (usingPost
                ? this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(parentId, [...new Set(delSfks)])
                : this.helementApi.findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(parentId, [...new Set(delSfks)].join(','))
              ).then((moreHes) => uniqBy(hes.concat(moreHes), 'id'))
            : hes
        )
      )
      const retrievedForms = await retry(() =>
        (usingPost
          ? this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, [...new Set(delSfks)])
          : this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeys(ownerId, [...new Set(delSfks)].join(','))
        ).then((frms) =>
          parentId
            ? (usingPost
                ? this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(parentId, [...new Set(delSfks)])
                : this.formApi.findFormsDelegationsStubsByHCPartyPatientForeignKeys(parentId, [...new Set(delSfks)].join(','))
              ).then((moreFrms) => uniqBy(frms.concat(moreFrms), 'id'))
            : frms
        )
      )
      const retrievedContacts = await retry(() =>
        (usingPost
          ? this.contactApi.findByHCPartyPatientSecretFKeysUsingPost(ownerId, undefined, undefined, [...new Set(delSfks)])
          : this.contactApi.findByHCPartyPatientSecretFKeys(ownerId, [...new Set(delSfks)].join(','))
        ).then((ctcs) =>
          parentId
            ? (usingPost
                ? this.contactApi.findByHCPartyPatientSecretFKeysUsingPost(parentId, undefined, undefined, [...new Set(delSfks)])
                : this.contactApi.findByHCPartyPatientSecretFKeys(parentId, [...new Set(delSfks)].join(','))
              ).then((moreCtcs) => uniqBy(ctcs.concat(moreCtcs), 'id'))
            : ctcs
        )
      )
      const retrievedInvoices = await retry(() =>
        (usingPost
          ? this.invoiceApi.findInvoicesDelegationsStubsByHCPartyPatientForeignKeysUsingPost(ownerId, [...new Set(delSfks)])
          : this.invoiceApi.findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(ownerId, [...new Set(delSfks)].join(','))
        ).then((ivs) =>
          parentId
            ? this.invoiceApi
                .findInvoicesDelegationsStubsByHCPartyPatientForeignKeys(parentId, [...new Set(delSfks)].join(','))
                .then((moreIvs) => uniqBy(ivs.concat(moreIvs), 'id'))
            : ivs
        )
      )
      const retrievedClassifications = await retry(() =>
        this.classificationApi
          .findClassificationsByHCPartyPatientForeignKeys(ownerId, [...new Set(delSfks)].join(','))
          .then((cls) =>
            parentId
              ? this.classificationApi
                  .findClassificationsByHCPartyPatientForeignKeys(parentId, [...new Set(delSfks)].join(','))
                  .then((moreCls) => uniqBy(cls.concat(moreCls), 'id'))
              : cls
          )
      )
      const retrievedCalendarItems = await retry(() =>
        (usingPost
          ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(ownerId, [...new Set(delSfks)])
          : this.calendarItemApi.findByHCPartyPatientSecretFKeys(ownerId, [...new Set(delSfks)].join(','))
        ).then((cls) =>
          parentId
            ? (usingPost
                ? this.calendarItemApi.findByHCPartyPatientSecretFKeysArray(parentId, [...new Set(delSfks)])
                : this.calendarItemApi.findByHCPartyPatientSecretFKeys(parentId, [...new Set(delSfks)].join(','))
              ).then((moreCls) => uniqBy(cls.concat(moreCls), 'id'))
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
        doShareMinimal: (request: BulkShareOrUpdateMetadataParams) => Promise<MinimalEntityBulkShareResult[]>
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
      await doShareEntitiesAndUpdateStatus(
        retrievedHealthElements,
        EntityWithDelegationTypeName.HealthElement,
        status.healthElements,
        isMedicalInfoTags,
        (x) => this.helementApi.bulkShareHealthElementsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedContacts, EntityWithDelegationTypeName.Contact, status.contacts, isMedicalInfoTags, (x) =>
        this.contactApi.bulkShareContactsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedInvoices, EntityWithDelegationTypeName.Invoice, status.invoices, isFinancialInfoTags, (x) =>
        this.invoiceApi.bulkShareInvoicesMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(
        retrievedClassifications,
        EntityWithDelegationTypeName.Classification,
        status.classifications,
        isMedicalInfoTags,
        (x) => this.classificationApi.bulkShareClassificationsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(
        retrievedCalendarItems,
        EntityWithDelegationTypeName.CalendarItem,
        status.calendarItems,
        isMedicalInfoTags,
        (x) => this.calendarItemApi.bulkShareCalendarItemsMinimal(x)
      )
      await doShareEntitiesAndUpdateStatus(retrievedForms, EntityWithDelegationTypeName.Form, status.forms, isMedicalInfoTags, (x) =>
        this.formApi.bulkShareFormsMinimal(x)
      )
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
      .bulkShareOrUpdateEncryptedEntityMetadata(EntityWithDelegationTypeName.Patient, [sharePatientRequest], (x) => this.bulkSharePatients(x))
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

  /**
   * Exports a patient and all related medical data.
   * @param user the current user
   * @param patId the patient id
   * @param ownerId the owner healthcare party id
   * @return object containing the patient and all related entities (contacts, forms, health elements, invoices, classifications, calendar items, documents)
   */
  async export(
    user: models.User,
    patId: string,
    ownerId: string
  ): Promise<{
    id: string
    patient: Patient | null
    contacts: models.Contact[]
    forms: models.Form[]
    healthElements: models.HealthElement[]
    invoices: models.Invoice[]
    classifications: models.Classification[]
    calItems: models.CalendarItem[]
    documents: models.Document[]
  }> {
    const parentId = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds().then((h) => (h.length - 2 >= 0 ? h[h.length - 2] : h[0]))
    const patient = await retry(async () => {
      const retrieved: Patient | undefined = await this.getPatientWithUser(user, patId)
      if (retrieved != undefined) {
        const initialised = await this.crypto.xapi.ensureEncryptionKeysInitialised(retrieved, EntityWithDelegationTypeName.Patient)
        if (!initialised) {
          return retrieved
        } else {
          return await this.modifyPatientWithUser(user, initialised)
        }
      } else {
        return null
      }
    })
    const delSfks =
      patient != null ? await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, ownerId) : []
    if (delSfks.length <= 0) {
      return {
        id: patId,
        patient,
        contacts: [],
        forms: [],
        healthElements: [],
        invoices: [],
        classifications: [],
        calItems: [],
        documents: [],
      }
    }
    const contactIds = new Set([
      ...(await retry(() => this.contactApi.findContactIdsByDataOwnerPatientOpeningDate(ownerId, delSfks))),
      ...(await retry(() => this.contactApi.findContactIdsByDataOwnerPatientOpeningDate(parentId, delSfks))),
    ])
    const formIds = new Set([
      ...(await retry(() => this.formApi.findFormIdsByDataOwnerPatientOpeningDate(ownerId, delSfks))),
      ...(await retry(() => this.formApi.findFormIdsByDataOwnerPatientOpeningDate(parentId, delSfks))),
    ])
    const healthElementIds = new Set([
      ...(await retry(() => this.helementApi.findHealthElementIdsByDataOwnerPatientOpeningDate(ownerId, delSfks))),
      ...(await retry(() => this.helementApi.findHealthElementIdsByDataOwnerPatientOpeningDate(parentId, delSfks))),
    ])
    const invoiceIds = new Set([
      ...(await retry(() => this.invoiceApi.findInvoiceIdsByDataOwnerPatientInvoiceDate(ownerId, delSfks))),
      ...(await retry(() => this.invoiceApi.findInvoiceIdsByDataOwnerPatientInvoiceDate(parentId, delSfks))),
    ])
    const classificationIds = new Set([
      ...(await retry(() => this.classificationApi.findClassificationIdsByDataOwnerPatientCreated(ownerId, delSfks))),
      ...(await retry(() => this.classificationApi.findClassificationIdsByDataOwnerPatientCreated(parentId, delSfks))),
    ])
    const calendarItemIds = new Set([
      ...(await retry(() => this.calendarItemApi.findCalendarItemIdsByDataOwnerPatientStartTime(ownerId, delSfks))),
      ...(await retry(() => this.calendarItemApi.findCalendarItemIdsByDataOwnerPatientStartTime(parentId, delSfks))),
    ])
    async function batchGet<T>(items: string[], get: (batch: string[]) => Promise<T[]>, batchSize: number = 1000): Promise<T[]> {
      const results: T[] = []
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const res = await retry(() => get(batch))
        results.push(...res)
      }
      return results
    }
    const contacts = await batchGet([...contactIds], (x): Promise<models.Contact[]> => this.contactApi.getContactsWithUser(user, { ids: x }))
    const forms = await batchGet([...formIds], (x): Promise<models.Form[]> => this.formApi.getForms({ ids: x }))
    const healthElements = await batchGet(
      [...healthElementIds],
      (x): Promise<models.HealthElement[]> => this.helementApi.getHealthElementsWithUser(user, { ids: x })
    )
    const invoices = await batchGet([...invoiceIds], (x): Promise<models.Invoice[]> => this.invoiceApi.getInvoices({ ids: x }))
    const classifications = await batchGet(
      [...classificationIds],
      (x): Promise<models.Classification[]> => this.classificationApi.getClassifications({ ids: x })
    )
    const calItems = await batchGet(
      [...calendarItemIds],
      (x): Promise<models.CalendarItem[]> => this.calendarItemApi.getCalendarItemsWithIdsWithUser(user, { ids: x })
    )
    const documentIds = new Set<string>()
    contacts.forEach((contact) => {
      contact.services?.forEach((service) => {
        Object.values(service.content ?? {}).forEach((content) => {
          if (!!content.documentId) documentIds.add(content.documentId)
        })
      })
    })
    const documents = await batchGet([...documentIds], (x): Promise<models.Document[]> => this.documentApi.getDocumentsWithUser(user, { ids: x }))
    return {
      id: patId,
      patient,
      calItems,
      classifications,
      contacts,
      documents,
      forms,
      healthElements,
      invoices,
    }
  }

  /**
   * Validates a Belgian INAMI number using modulo 97 check.
   * @param inami the INAMI number to validate
   * @return true if the INAMI number is valid, false otherwise
   */
  checkInami(inami: string): boolean {
    const num_inami = inami.replace(new RegExp('[^(0-9)]', 'g'), '')

    const checkDigit = num_inami.substring(6, 8)
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

  /**
   * Validates a Belgian social security identification number (SSIN/NISS) including support for bis and ter numbers.
   * @param ssin the SSIN to validate
   * @return true if the SSIN is valid, false otherwise
   */
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
        97 - (Number(ssin.substring(0, 9)) % 97) === Number(ssin.substring(9, 11))
          ? true
          : 97 - (Number('2' + ssin.substring(0, 9)) % 97) === Number(ssin.substring(9, 11))
    }

    return isValidNiss
  }

  /**
   * Extracts the patient id from a child document, following merge chains if necessary.
   * @param childDocument the child document (invoice, calendar item, contact, or access log)
   * @param hcpId the healthcare party id
   * @param childDocumentType the type of the child document
   * @return the patient id after following any merge chains
   */
  async getPatientIdOfChildDocumentForHcpAndHcpParents(
    childDocument: models.Invoice | models.CalendarItem | models.Contact | models.AccessLog,
    hcpId: string,
    childDocumentType: EntityWithDelegationTypeName
  ): Promise<string> {
    const parentIdsArray = await this.crypto.xapi.owningEntityIdsOf({ entity: childDocument, type: childDocumentType }, hcpId)

    const multipleParentIds = [...new Set(parentIdsArray)].length > 1

    if (multipleParentIds) {
      throw 'Child document with id ' + childDocument.id + ' contains multiple parent ids in its CFKs for hcpId: ' + hcpId
    }

    const parentId = parentIdsArray[0]

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
    return this.crypto.xapi.hasWriteAccess({ entity: patient, type: EntityWithDelegationTypeName.Patient })
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
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    patient: models.Patient,
    shareSecretIds: string[],
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Patient> {
    return this.shareWithMany(patient, { [delegateId]: { ...options, shareSecretIds: shareSecretIds } })
  }

  /**
   * Share an existing patient with other data owners, allowing them to access the non-encrypted data of the patient and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param patient the patient to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds the secret ids of the Patient that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Patient is the owning entity id.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * patient does not have encrypted content.
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    patient: models.Patient,
    delegates: {
      [delegateIds: string]: {
        shareSecretIds: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Patient> {
    return (await this.tryShareWithMany(patient, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing patient with other data owners, allowing them to access the non-encrypted data of the patient and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param patient the patient to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds the secret ids of the Patient that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Patient is the owning entity id.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * patient does not have encrypted content.
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    patient: models.Patient,
    delegates: {
      [delegateIds: string]: {
        shareSecretIds: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Patient>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(patient, EntityWithDelegationTypeName.Patient)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyPatientAs(self, entityWithEncryptionKey) : patient
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.Patient,
        },
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
              shareSecretIds: options.shareSecretIds,
            },
          ])
        ),
        (x) => this.bulkSharePatients(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decryptAs(self, [e]).then((es) => es[0])))
  }

  /**
   * @param patient a patient
   * @return all the decryptable secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, undefined)
  }

  /**
   * @param patient a patient
   * @return the confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.xapi.getConfidentialSecretIds({ entity: patient, type: EntityWithDelegationTypeName.Patient }, undefined)
  }

  /**
   * @param patient a patient
   * @return the non-confidential secret ids of the patient, retrieved from the encrypted metadata. The result may be used to find entities where the
   * patient is the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptNonConfidentialSecretIdsOf(patient: models.Patient): Promise<string[]> {
    return this.crypto.xapi.getSecretIdsSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient })
  }

  /**
   * Gets all data owners with access to the patient and their permission levels.
   * @param entity the patient
   * @return object containing permissions by data owner id and a flag indicating if there are unknown anonymous data owners
   */
  getDataOwnersWithAccessTo(
    entity: models.Patient
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Patient })
  }

  /**
   * Gets all encryption keys of the patient that the current user can decrypt.
   * @param entity the patient
   * @return array of encryption keys
   */
  getEncryptionKeysOf(entity: models.Patient): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Patient }, undefined)
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
    const encryptedMerged = (await this.encryptAs(await this.dataOwnerApi.getCurrentDataOwnerId(), [mergedInto]))[0]
    const merged = await super.baseMergePatients(from.id!, from.rev!, encryptedMerged)
    return (await this.tryDecryptOrReturnOriginal([merged]))[0].entity
  }

  /**
   * Subscribes to patient events (create, update, delete) and automatically decrypts them.
   * @param eventTypes the types of events to subscribe to
   * @param filter optional filter to apply to events
   * @param eventFired callback function to handle each event
   * @param options optional subscription options
   * @return connection object to manage the subscription
   */
  async subscribeToPatientEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<Patient> | undefined,
    eventFired: (patient: Patient) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const currentUser = await this.userApi.getCurrentUser()
    return subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.Patient,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt(currentUser, [encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  /**
   * Creates or updates de-anonymization metadata for patient delegations.
   * @param entity the patient
   * @param delegates array of delegate ids to create metadata for
   */
  createDelegationDeAnonymizationMetadata(entity: Patient, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Patient }, delegates)
  }

  /**
   * Initializes the exchange data towards a newly invited patient. This allows the doctor to share data with the
   * patient even if the patient has not yet initialized a keypair for himself.
   *
   * This method should be used only if the patient has not yet initialized a keypair for himself. If the patient has
   * already initialized a keypair this method does nothing and returns false. In this case the exchange data will be
   * automatically created the first time you share data with the patient, and your implementation of the crypto
   * strategies will be used to validate the public keys of the patient.
   *
   * Once exchange data is initialized you can use the {@link IccRecoveryXApi.createExchangeDataRecoveryInfo} to
   * generate a key that the patient will be able to use on his first login to immediately gain access to the exchange
   * data (through the {@link IccRecoveryXApi.recoverExchangeData} method).
   *
   * @param patientId the id of the newly invited patient.
   * @return true if exchange data was initialized, false if the patient already has a key pair and the exchange data
   * will be initialized in the standard way (automatically on the first time data is shared with the user).
   */
  async forceInitialiseExchangeDataToNewlyInvitedPatient(patientId: string): Promise<boolean> {
    const patient = await super.getPatient(patientId)
    if (this.dataOwnerApi.getHexPublicKeysOf(patient).size) return false
    await this.crypto.exchangeData.getOrCreateEncryptionDataTo(patientId, {
      allowCreationWithoutDelegateKey: true,
    })
    return true
  }
}
