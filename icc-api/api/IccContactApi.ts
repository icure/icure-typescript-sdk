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
import { AbstractFilterContact } from '../model/AbstractFilterContact'
import { AbstractFilterService } from '../model/AbstractFilterService'
import { Contact } from '../model/Contact'
import { Content } from '../model/Content'
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainContact } from '../model/FilterChainContact'
import { FilterChainService } from '../model/FilterChainService'
import { IcureStub } from '../model/IcureStub'
import { LabelledOccurence } from '../model/LabelledOccurence'
import { ListOfIds } from '../model/ListOfIds'
import { PaginatedListContact } from '../model/PaginatedListContact'
import { PaginatedListService } from '../model/PaginatedListService'
import { Service } from '../model/Service'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { MinimalEntityBulkShareResult } from '../model/requests/MinimalEntityBulkShareResult'
import { BulkShareOrUpdateMetadataParams } from '../model/requests/BulkShareOrUpdateMetadataParams'

export class IccContactApi {
  host: string
  _headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  get headers(): Promise<Array<XHR.Header>> {
    return Promise.resolve(this._headers)
  }

  constructor(
    host: string,
    headers: any,
    authenticationProvider?: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = iccRestApiPath(host)
    this._headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = !!authenticationProvider ? authenticationProvider : new NoAuthenticationProvider()
    this.fetchImpl = fetchImpl
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Keys must be delimited by coma
   * @summary Close contacts for Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  async closeForHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<Contact>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys/close` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = await this.headers
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Creates a contact with the current user and returns an instance of created contact afterward.
   * @summary Create a contact with the current user
   * @param body
   */
  async createContact(body?: Contact): Promise<Contact> {
    const _url = this.host + `/contact` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Contact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified contacts.
   * @summary Create a batch of contacts
   * @param body
   */
  async createContacts(body?: Array<Contact>): Promise<Array<Contact>> {
    const _url = this.host + `/contact/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of contacts.
   *
   * @param contactIds a ListOfIds containing the ids of the contacts to delete.
   * @return a Promise that will resolve in an array of the DocIdentifiers of the successfully deleted contacts.
   */
  async deleteContacts(contactIds: ListOfIds): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/contact/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      contactIds,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single contact by id.
   *
   * @param contactId the id of the contact to delete.
   */
  async deleteContact(contactId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/contact/${encodeURIComponent(contactId)}` + '?ts=' + new Date().getTime(),
      await this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc.body))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of contacts along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List contacts for the current user (HcParty) or the given hcparty in the filter
   * @param body
   * @param startDocumentId A Contact document ID
   * @param limit Number of rows
   */
  async filterContactsBy(startDocumentId?: string, limit?: number, body?: FilterChainContact): Promise<PaginatedListContact> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListContact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of contacts along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List services for the current user (HcParty) or the given hcparty in the filter
   * @param body
   * @param startDocumentId A Contact document ID
   * @param limit Number of rows
   */
  async filterServicesBy(startDocumentId?: string, limit?: number, body?: FilterChainService): Promise<PaginatedListService> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/service/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListService(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a list of contacts found by Healthcare Party and form's id.
   * @param hcPartyId
   * @param formId
   */
  async findByHCPartyFormId(hcPartyId: string, formId: string): Promise<Array<Contact>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartyFormId` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (formId ? '&formId=' + encodeURIComponent(String(formId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a list of contacts found by Healthcare Party and form's ids.
   * @param body
   * @param hcPartyId
   */
  async findByHCPartyFormIds(hcPartyId: string, body?: ListOfIds): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartyFormIds` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Get a list of contacts found by Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param planOfActionsIds
   * @param skipClosedContacts
    @param body
   */
  async findByHCPartyPatientSecretFKeysUsingPost(
    hcPartyId: string,
    planOfActionsIds?: string,
    skipClosedContacts?: boolean,
    body?: Array<string>
  ): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (planOfActionsIds ? '&planOfActionsIds=' + encodeURIComponent(String(planOfActionsIds)) : '') +
      (skipClosedContacts ? '&skipClosedContacts=' + encodeURIComponent(String(skipClosedContacts)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Get a list of contacts found by Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   * @param planOfActionsIds
   * @param skipClosedContacts
   */
  async findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys: string,
    planOfActionsIds?: string,
    skipClosedContacts?: boolean
  ): Promise<Array<Contact>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '') +
      (planOfActionsIds ? '&planOfActionsIds=' + encodeURIComponent(String(planOfActionsIds)) : '') +
      (skipClosedContacts ? '&skipClosedContacts=' + encodeURIComponent(String(skipClosedContacts)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By Healthcare Party and service Id.
   * @param hcPartyId
   * @param serviceId
   */
  async findByHCPartyServiceId(hcPartyId: string, serviceId: string): Promise<Array<Contact>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartyServiceId` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (serviceId ? '&serviceId=' + encodeURIComponent(String(serviceId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By externalId.
   * @param externalId
   */
  async findContactsByExternalId(externalId: string): Promise<Array<Contact>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byExternalId` +
      '?ts=' +
      new Date().getTime() +
      (externalId ? '&externalId=' + encodeURIComponent(String(externalId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a list of contacts found by Healthcare Party and Patient foreign keys.
   * @param body
   * @param hcPartyId
   */
  async findContactsByHCPartyPatientForeignKeys(hcPartyId: string, body?: ListOfIds): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartyPatientForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Get a list of contacts found by Healthcare Party and a patient foreign key with pagination.
   * @param hcPartyId the id of the healthcare party.
   * @param patientForeignKey the secret foreign key,
   * @param startKey the startKey provided by the previous page or undefined for the first page.
   * @param startDocumentId the startDocumentId provided by the previous page or undefined for the first page.
   * @param limit the number of elements that the page should contain.
   * @return a promise that will resolve in a PaginatedListContact.
   */
  async findContactsByHCPartyPatientForeignKey(
    hcPartyId: string,
    patientForeignKey: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListContact> {
    const _url =
      this.host +
      `/contact/byHcPartyPatientForeignKey?ts=${new Date().getTime()}` +
      `&hcPartyId=${encodeURIComponent(hcPartyId)}` +
      `&patientForeignKey=${encodeURIComponent(patientForeignKey)}` +
      (!!startKey ? `&startKey=${encodeURIComponent(startKey)}` : '') +
      (!!startDocumentId ? `&startDocumentId=${encodeURIComponent(startDocumentId)}` : '') +
      (!!limit ? `&limit=${limit}` : '')
    const headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListContact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List contacts found By Healthcare Party and secret foreign keys.
   * @param body
   * @param hcPartyId
   */
  async findContactsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(hcPartyId: string, body?: Array<string>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys/delegations` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  async findContactsDelegationsStubsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<IcureStub>> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys/delegations` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Gets a contact based on its id
   * @summary Get a contact
   * @param contactId
   */
  async getContact(contactId: string): Promise<Contact> {
    let _body = null

    const _url = this.host + `/contact/${encodeURIComponent(String(contactId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Contact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Gets a service based on its id
   * @summary Get a service
   * @param serviceId
   */
  async getService(serviceId: string): Promise<Service> {
    let _body = null

    const _url = this.host + `/contact/service/${encodeURIComponent(String(serviceId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Service(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a list of contact by ids/keys.
   * @summary Get contacts by batch
   * @param body
   */
  async getContacts(body?: ListOfIds): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/byIds` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get an empty content
   */
  async getEmptyContent(): Promise<Content> {
    let _body = null

    const _url = this.host + `/contact/service/content/empty` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get the list of all used codes frequencies in services
   * @param codeType
   * @param minOccurences
   */
  async getServiceCodesOccurences(codeType: string, minOccurences: number): Promise<Array<LabelledOccurence>> {
    let _body = null

    const _url =
      this.host +
      `/contact/service/codes/${encodeURIComponent(String(codeType))}/${encodeURIComponent(String(minOccurences))}` +
      '?ts=' +
      new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new LabelledOccurence(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of contacts.
   * @summary List contacts bu opening date parties with(out) pagination
   * @param startKey The contact openingDate
   * @param endKey The contact max openingDate
   * @param hcpartyid hcpartyid
   * @param startDocumentId A contact party document ID
   * @param limit Number of rows
   */
  async listContactsByOpeningDate(
    startKey: number,
    endKey: number,
    hcpartyid: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListContact> {
    let _body = null

    const _url =
      this.host +
      `/contact/byOpeningDate` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (endKey ? '&endKey=' + encodeURIComponent(String(endKey)) : '') +
      (hcpartyid ? '&hcpartyid=' + encodeURIComponent(String(hcpartyid)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListContact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of services
   * @summary List services with provided ids
   * @param body
   */
  async listServices(body?: ListOfIds): Promise<Array<Service>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/service/byIds` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Service(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of services
   * @summary List services by related association id
   * @param associationId
   */
  async listServicesByAssociationId(associationId: string): Promise<Array<Service>> {
    let _body = null

    const _url =
      this.host +
      `/contact/service/associationId` +
      '?ts=' +
      new Date().getTime() +
      (associationId ? '&associationId=' + encodeURIComponent(String(associationId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Service(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the list of services linked to the provided health element id
   * @summary List services linked to a health element
   * @param healthElementId
   * @param hcPartyId hcPartyId
   */
  async listServicesByHealthElementId(healthElementId: string, hcPartyId: string): Promise<Array<Service>> {
    let _body = null

    const _url =
      this.host +
      `/contact/service/healthElementId/${encodeURIComponent(String(healthElementId))}` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Service(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of services
   * @summary List services linked to provided ids
   * @param body
   * @param linkType The type of the link
   */
  async listServicesLinkedTo(linkType?: string, body?: ListOfIds): Promise<Array<Service>> {
    let _body = null
    _body = body

    const _url =
      this.host + `/contact/service/linkedTo` + '?ts=' + new Date().getTime() + (linkType ? '&linkType=' + encodeURIComponent(String(linkType)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Service(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of contacts matching the provided filter for the current user (HcParty)
   * @param body
   */
  async matchContactsBy(body?: AbstractFilterContact): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/match` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of services matching the provided filter for the current user
   * @param body
   */
  async matchServicesBy(body?: AbstractFilterService): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/service/match` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified contact.
   * @summary Modify a contact
   * @param body
   */
  async modifyContact(body?: Contact): Promise<Contact> {
    let _body = null
    _body = body

    const _url = this.host + `/contact` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Contact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified contacts.
   * @summary Modify a batch of contacts
   * @param body
   */
  async modifyContacts(body?: Array<Contact>): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * It delegates a contact to a healthcare party (By current healthcare party). Returns the contact with new delegations.
   * @summary Delegates a contact to a healthcare party
   * @param body
   * @param contactId
   */
  async newContactDelegations(contactId: string, body?: Delegation): Promise<Contact> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/${encodeURIComponent(String(contactId))}/delegate` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Contact(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in healthElements.
   * @param body
   */
  async setContactsDelegations(body?: Array<IcureStub>): Promise<Array<Contact>> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/delegations` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Contact(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareContacts(request: BulkShareOrUpdateMetadataParams): Promise<EntityBulkShareResult<Contact>[]> {
    const _url = this.host + '/contact/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<Contact>(x, Contact)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareContactsMinimal(request: BulkShareOrUpdateMetadataParams): Promise<MinimalEntityBulkShareResult[]> {
    const _url = this.host + '/contact/bulkSharedMetadataUpdateMinimal' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new MinimalEntityBulkShareResult(x)))
      .catch((err) => this.handleError(err))
  }
}
