/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from './XHR'
import { AbstractFilterPatient } from '../model/AbstractFilterPatient'
import { Content } from '../model/Content'
import { DataOwnerRegistrationSuccess } from '../model/DataOwnerRegistrationSuccess'
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainPatient } from '../model/FilterChainPatient'
import { IdWithRev } from '../model/IdWithRev'
import { ListOfIds } from '../model/ListOfIds'
import { PaginatedListPatient } from '../model/PaginatedListPatient'
import { PaginatedListString } from '../model/PaginatedListString'
import { Patient } from '../model/Patient'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'

export class IccPatientApi {
  host: string
  headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    authenticationProvider?: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = iccRestApiPath(host)
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = !!authenticationProvider ? authenticationProvider : new NoAuthenticationProvider()
    this.fetchImpl = fetchImpl
  }
  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Returns the id and _rev of created patients
   * @summary Create patients in bulk
   * @param body
   */
  bulkCreatePatients(body?: Array<Patient>): Promise<Array<IdWithRev>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IdWithRev(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the id and _rev of created patients
   * @summary Create patients in bulk
   * @param body
   */
  bulkCreatePatients1(body?: Array<Patient>): Promise<Array<IdWithRev>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/bulk` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IdWithRev(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the id and _rev of modified patients
   * @summary Modify patients in bulk
   * @param body
   */
  bulkUpdatePatients(body?: Array<Patient>): Promise<Array<IdWithRev>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IdWithRev(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the id and _rev of modified patients
   * @summary Modify patients in bulk
   * @param body
   */
  bulkUpdatePatients1(body?: Array<Patient>): Promise<Array<IdWithRev>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/bulk` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IdWithRev(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the count of patients
   * @summary Get count of patients for a specific HcParty or for the current HcParty
   * @param hcPartyId Healthcare party id
   */
  countOfPatients(hcPartyId: string): Promise<Content> {
    let _body = null

    const _url = this.host + `/patient/hcParty/${encodeURIComponent(String(hcPartyId))}/count` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Name, last name, date of birth, and gender are required. After creation of the patient and obtaining the ID, you need to create an initial delegation.
   * @summary Create a patient
   * @param body
   */
  createPatient(body?: Patient): Promise<Patient> {
    let _body = null
    _body = body

    const _url = this.host + `/patient` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Response is an array containing the ID of deleted patient..
   * @summary Delete patients.
   * @param patientIds
   */
  deletePatient(patientIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/patient/${encodeURIComponent(String(patientIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter patients for the current user (HcParty)
   * @param body
   * @param startKey The start key for pagination, depends on the filters used
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param skip Skip rows
   * @param sort Sort key
   * @param desc Descending
   */
  filterPatientsBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: FilterChainPatient
  ): Promise<PaginatedListPatient> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/patient/filter` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (skip ? '&skip=' + encodeURIComponent(String(skip)) : '') +
      (sort ? '&sort=' + encodeURIComponent(String(sort)) : '') +
      (desc ? '&desc=' + encodeURIComponent(String(desc)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Paginated List of Patients sorted by Access logs descending
   * @param userId A User ID
   * @param accessType The type of access (COMPUTER or USER)
   * @param startDate The start search epoch
   * @param startKey The start key for pagination
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   */
  findByAccessLogUserAfterDate(
    userId: string,
    accessType?: string,
    startDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/byAccess/${encodeURIComponent(String(userId))}` +
      '?ts=' +
      new Date().getTime() +
      (accessType ? '&accessType=' + encodeURIComponent(String(accessType)) : '') +
      (startDate ? '&startDate=' + encodeURIComponent(String(startDate)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get the patient having the provided externalId
   * @param externalId A external ID
   */
  findByExternalId(externalId: string): Promise<Patient> {
    let _body = null

    const _url = this.host + `/patient/byExternalId/${encodeURIComponent(String(externalId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Find patients for the current user (HcParty)
   * @param healthcarePartyId HealthcareParty Id. If not set, will use user&#x27;s hcpId
   * @param filterValue Optional value for filtering results
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param sortDirection Optional value for providing a sorting direction (&#x27;asc&#x27;, &#x27;desc&#x27;). Set to &#x27;asc&#x27; by default.
   */
  findByNameBirthSsinAuto(
    healthcarePartyId?: string,
    filterValue?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/byNameBirthSsinAuto` +
      '?ts=' +
      new Date().getTime() +
      (healthcarePartyId ? '&healthcarePartyId=' + encodeURIComponent(String(healthcarePartyId)) : '') +
      (filterValue ? '&filterValue=' + encodeURIComponent(String(filterValue)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (sortDirection ? '&sortDirection=' + encodeURIComponent(String(sortDirection)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Provides a paginated list of patients with duplicate name for an hecparty
   * @param hcPartyId Healthcare party id
   * @param startKey The start key for pagination, depends on the filters used
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   */
  findDuplicatesByName(hcPartyId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/duplicates/name` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Provides a paginated list of patients with duplicate ssin for an hecparty
   * @param hcPartyId Healthcare party id
   * @param startKey The start key for pagination, depends on the filters used
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   */
  findDuplicatesBySsin(hcPartyId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/duplicates/ssin` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients
   * @summary Filter patients for the current user (HcParty)
   * @param firstName The first name
   * @param lastName The last name
   * @param dateOfBirth The date of birth
   */
  fuzzySearch(firstName?: string, lastName?: string, dateOfBirth?: number): Promise<Array<Patient>> {
    let _body = null

    const _url =
      this.host +
      `/patient/fuzzy` +
      '?ts=' +
      new Date().getTime() +
      (firstName ? '&firstName=' + encodeURIComponent(String(firstName)) : '') +
      (lastName ? '&lastName=' + encodeURIComponent(String(lastName)) : '') +
      (dateOfBirth ? '&dateOfBirth=' + encodeURIComponent(String(dateOfBirth)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Patient(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * It gets patient administrative data.
   * @summary Get patient
   * @param patientId
   */
  getPatient(patientId: string): Promise<Patient> {
    let _body = null

    const _url = this.host + `/patient/${encodeURIComponent(String(patientId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * (key, value) of the map is as follows: (ID of the owner of the encrypted AES key, encrypted AES keys)
   * @summary Get the HcParty encrypted AES keys indexed by owner.
   * @param patientId
   */
  getPatientAesExchangeKeysForDelegate(
    patientId: string
  ): Promise<{ [delegatorId: string]: { [delegatorPubKeyFingerprint: string]: { [delegatePubKeyFingerprint: string]: string } } }> {
    let _body = null

    const _url = this.host + `/patient/${encodeURIComponent(String(patientId))}/aesExchangeKeys` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * It gets patient administrative data based on the identifier (root & extension) parameters.
   * @summary Get patient by identifier
   * @param hcPartyId
   * @param id
   * @param system
   */
  getPatientByHealthcarepartyAndIdentifier(hcPartyId: string, id: string, system?: string): Promise<Patient> {
    let _body = null

    const _url =
      this.host +
      `/patient/${encodeURIComponent(String(hcPartyId))}/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (system ? '&system=' + encodeURIComponent(String(system)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * This endpoint is used to recover all keys that have already been created and that can be used to share information with this patient. It returns a map with the following structure: ID of the owner of the encrypted AES key -> encrypted AES key. The returned encrypted AES keys will have to be decrypted using the patient's private key.                  {                     \"hcparty 1 delegator ID\": \"AES hcparty key (encrypted using patient public RSA key)\"                     \"hcparty 2 delegator ID\": \"other AES hcparty key (encrypted using patient public RSA key)\"                 }
   * @summary Get the patient (identified by patientId) hcparty keys. Those keys are AES keys (encrypted) used to share information between HCPs and a patient.
   * @param patientId The patient Id for which information is shared
   */
  getPatientHcPartyKeysForDelegate(patientId: string): Promise<{ [key: string]: string }> {
    let _body = null

    const _url = this.host + `/patient/${encodeURIComponent(String(patientId))}/keys` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * It gets patient administrative data.
   * @summary Get patients by id
   * @param body
   */
  getPatients(body?: ListOfIds): Promise<Array<Patient>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/byIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Patient(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of deleted patients, within the specified time period, if any.
   * @summary Find deleted patients
   * @param startDate Filter deletions after this date (unix epoch), included
   * @param endDate Filter deletions before this date (unix epoch), included
   * @param desc Descending
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   */
  listDeletedPatients(startDate?: number, endDate?: number, desc?: boolean, startDocumentId?: string, limit?: number): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/deleted/by_date` +
      '?ts=' +
      new Date().getTime() +
      (startDate ? '&startDate=' + encodeURIComponent(String(startDate)) : '') +
      (endDate ? '&endDate=' + encodeURIComponent(String(endDate)) : '') +
      (desc ? '&desc=' + encodeURIComponent(String(desc)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of deleted patients, by name and/or firstname prefix, if any.
   * @summary Find deleted patients
   * @param firstName First name prefix
   * @param lastName Last name prefix
   */
  listDeletedPatientsByName(firstName?: string, lastName?: string): Promise<Array<Patient>> {
    let _body = null

    const _url =
      this.host +
      `/patient/deleted/by_name` +
      '?ts=' +
      new Date().getTime() +
      (firstName ? '&firstName=' + encodeURIComponent(String(firstName)) : '') +
      (lastName ? '&lastName=' + encodeURIComponent(String(lastName)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Patient(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients that have been merged after the provided date
   * @summary List patients that have been merged towards another patient
   * @param date
   */
  listOfMergesAfter(date: number): Promise<Array<Patient>> {
    let _body = null

    const _url = this.host + `/patient/merges/${encodeURIComponent(String(date))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Patient(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients that have been modified after the provided date
   * @summary List patients that have been modified after the provided date
   * @param date
   * @param startKey The start key for pagination the date of the first element of the new page
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   */
  listOfPatientsModifiedAfter(date: number, startKey?: number, startDocumentId?: string, limit?: number): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/modifiedAfter/${encodeURIComponent(String(date))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List patients for a specific HcParty
   * @param hcPartyId Healthcare party id
   * @param sortField Optional value for sorting results by a given field (&#x27;name&#x27;, &#x27;ssin&#x27;, &#x27;dateOfBirth&#x27;). Specifying this deactivates filtering
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param sortDirection Optional value for providing a sorting direction (&#x27;asc&#x27;, &#x27;desc&#x27;). Set to &#x27;asc&#x27; by default.
   */
  listPatients(
    hcPartyId?: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (sortField ? '&sortField=' + encodeURIComponent(String(sortField)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (sortDirection ? '&sortDirection=' + encodeURIComponent(String(sortDirection)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List patients for a specific HcParty or for the current HcParty
   * @param hcPartyId
   * @param sortField Optional value for sorting results by a given field (&#x27;name&#x27;, &#x27;ssin&#x27;, &#x27;dateOfBirth&#x27;). Specifying this deactivates filtering
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param sortDirection Optional value for providing a sorting direction (&#x27;asc&#x27;, &#x27;desc&#x27;). Set to &#x27;asc&#x27; by default.
   */
  listPatientsByHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/hcParty/${encodeURIComponent(String(hcPartyId))}` +
      '?ts=' +
      new Date().getTime() +
      (sortField ? '&sortField=' + encodeURIComponent(String(sortField)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (sortDirection ? '&sortDirection=' + encodeURIComponent(String(sortDirection)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List patients by pages for a specific HcParty
   * @param hcPartyId Healthcare party id
   * @param startKey The page first id
   * @param startDocumentId A patient document ID
   * @param limit Page size
   */
  listPatientsIds(hcPartyId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListString> {
    let _body = null

    const _url =
      this.host +
      `/patient/idsPages` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListString(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of patients along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List patients of a specific HcParty or of the current HcParty
   * @param hcPartyId
   * @param sortField Optional value for sorting results by a given field (&#x27;name&#x27;, &#x27;ssin&#x27;, &#x27;dateOfBirth&#x27;). Specifying this deactivates filtering
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param sortDirection Optional value for providing a sorting direction (&#x27;asc&#x27;, &#x27;desc&#x27;). Set to &#x27;asc&#x27; by default.
   */
  listPatientsOfHcParty(
    hcPartyId: string,
    sortField?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    sortDirection?: string
  ): Promise<PaginatedListPatient> {
    let _body = null

    const _url =
      this.host +
      `/patient/ofHcParty/${encodeURIComponent(String(hcPartyId))}` +
      '?ts=' +
      new Date().getTime() +
      (sortField ? '&sortField=' + encodeURIComponent(String(sortField)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (sortDirection ? '&sortDirection=' + encodeURIComponent(String(sortDirection)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListPatient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of patients matching the provided filter for the current user (HcParty)
   * @param body
   */
  matchPatientsBy(body?: AbstractFilterPatient): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/match` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Merge a series of patients into another patient
   * @param toId
   * @param fromIds
   */
  mergeInto(toId: string, fromIds: string): Promise<Patient> {
    let _body = null

    const _url =
      this.host + `/patient/mergeInto/${encodeURIComponent(String(toId))}/from/${encodeURIComponent(String(fromIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * No particular return value. It's just a message.
   * @summary Modify a patient
   * @param body
   */
  modifyPatient(body?: Patient): Promise<Patient> {
    let _body = null
    _body = body

    const _url = this.host + `/patient` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Set a patient referral doctor
   * @param patientId
   * @param referralId The referal id. Accepts &#x27;none&#x27; for referral removal.
   * @param start Optional value for start of referral
   * @param end Optional value for end of referral
   */
  modifyPatientReferral(patientId: string, referralId: string, start?: number, end?: number): Promise<Patient> {
    let _body = null

    const _url =
      this.host +
      `/patient/${encodeURIComponent(String(patientId))}/referral/${encodeURIComponent(String(referralId))}` +
      '?ts=' +
      new Date().getTime() +
      (start ? '&start=' + encodeURIComponent(String(start)) : '') +
      (end ? '&end=' + encodeURIComponent(String(end)) : '')
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * It delegates a patient to a healthcare party (By current healthcare party). A modified patient with new delegation gets returned.
   * @summary Delegates a patients to a healthcare party
   * @param body
   * @param patientId
   */
  newPatientDelegations(patientId: string, body?: Array<Delegation>): Promise<Patient> {
    let _body = null
    _body = body

    const _url = this.host + `/patient/${encodeURIComponent(String(patientId))}/delegate` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Register a new patient into the system
   * @summary Register a patient
   * @param body
   * @param hcPartyId
   * @param groupId
   * @param token
   * @param useShortToken
   */
  registerPatient(
    hcPartyId: string,
    groupId: string,
    token?: string,
    useShortToken?: boolean,
    body?: Patient
  ): Promise<DataOwnerRegistrationSuccess> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/patient/register/forHcp/${encodeURIComponent(String(hcPartyId))}/inGroup/${encodeURIComponent(String(groupId))}` +
      '?ts=' +
      new Date().getTime() +
      (token ? '&token=' + encodeURIComponent(String(token)) : '') +
      (useShortToken ? '&useShortToken=' + encodeURIComponent(String(useShortToken)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DataOwnerRegistrationSuccess(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Response is an array containing the ID of undeleted patient..
   * @summary undelete previously deleted patients
   * @param patientIds
   */
  undeletePatient(patientIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/patient/undelete/${encodeURIComponent(String(patientIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal use mergePatients from the extended api instead
   */
  baseMergePatients(fromId: string, expectedFromRev: string, updatedInto: Patient) {
    let _body = updatedInto

    const _url =
      this.host +
      `/patient/mergeInto/${encodeURIComponent(String(updatedInto.id))}/from/${encodeURIComponent(String(fromId))}` +
      '?ts=' +
      new Date().getTime() +
      '&expectedFromRev=' +
      encodeURIComponent(String(expectedFromRev))
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Patient(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
