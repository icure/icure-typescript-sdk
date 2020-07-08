/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from "./XHR"
import { AbstractFilterDtoContact } from "../model/AbstractFilterDtoContact"
import { ContactDto } from "../model/ContactDto"
import { ContentDto } from "../model/ContentDto"
import { DelegationDto } from "../model/DelegationDto"
import { DocIdentifier } from "../model/DocIdentifier"
import { FilterChainContact } from "../model/FilterChainContact"
import { FilterChainService } from "../model/FilterChainService"
import { IcureStubDto } from "../model/IcureStubDto"
import { LabelledOccurenceDto } from "../model/LabelledOccurenceDto"
import { ListOfIdsDto } from "../model/ListOfIdsDto"
import { PaginatedListContactDto } from "../model/PaginatedListContactDto"
import { PaginatedListServiceDto } from "../model/PaginatedListServiceDto"

export class iccContactApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError) {
    throw e
  }

  /**
   * Keys must be delimited by coma
   * @summary Close contacts for Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  closeForHCPartyPatientForeignKeys(
    hcPartyId: string,
    secretFKeys: string
  ): Promise<Array<ContactDto> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys/close` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "")
    let headers = this.headers
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * Returns an instance of created contact.
   * @summary Create a contact with the current user
   * @param body
   */
  createContact(body?: ContactDto): Promise<ContactDto | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new ContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Response is a set containing the ID's of deleted contacts.
   * @summary Delete contacts.
   * @param contactIds
   */
  deleteContacts(contactIds: string): Promise<Array<DocIdentifier> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/${encodeURIComponent(String(contactIds))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new DocIdentifier(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * Returns a list of contacts along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List contacts for the current user (HcParty) or the given hcparty in the filter
   * @param body
   * @param startDocumentId A Contact document ID
   * @param limit Number of rows
   */
  filterContactsBy(
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainContact
  ): Promise<PaginatedListContactDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/filter` +
      "?ts=" +
      new Date().getTime() +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Returns a list of contacts along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary List services for the current user (HcParty) or the given hcparty in the filter
   * @param body
   * @param startDocumentId A Contact document ID
   * @param limit Number of rows
   */
  filterServicesBy(
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainService
  ): Promise<PaginatedListServiceDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/service/filter` +
      "?ts=" +
      new Date().getTime() +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListServiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By Healthcare Party and form Id.
   * @param hcPartyId
   * @param formId
   */
  findByHCPartyFormId(hcPartyId: string, formId: string): Promise<Array<ContactDto> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartyFormId` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (formId ? "&formId=" + encodeURIComponent(String(formId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By Healthcare Party and form Id.
   * @param body
   * @param hcPartyId
   */
  findByHCPartyFormIds(hcPartyId: string, body?: ListOfIdsDto): Promise<Array<ContactDto> | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartyFormIds` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List contacts found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   * @param planOfActionsIds
   * @param skipClosedContacts
   */
  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys: string,
    planOfActionsIds?: string,
    skipClosedContacts?: boolean
  ): Promise<Array<ContactDto> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "") +
      (planOfActionsIds
        ? "&planOfActionsIds=" + encodeURIComponent(String(planOfActionsIds))
        : "") +
      (skipClosedContacts
        ? "&skipClosedContacts=" + encodeURIComponent(String(skipClosedContacts))
        : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary List contacts found By Healthcare Party and Patient foreign keys.
   * @param body
   * @param hcPartyId
   */
  findContactsByHCPartyPatientForeignKeys(
    hcPartyId: string,
    body?: ListOfIdsDto
  ): Promise<Array<ContactDto> | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/byHcPartyPatientForeignKeys` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List contacts found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  findContactsDelegationsStubsByHCPartyPatientForeignKeys(
    hcPartyId: string,
    secretFKeys: string
  ): Promise<Array<IcureStubDto> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/byHcPartySecretForeignKeys/delegations` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new IcureStubDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get a contact
   * @param contactId
   */
  getContact(contactId: string): Promise<ContactDto | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/${encodeURIComponent(String(contactId))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new ContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get contacts
   * @param body
   */
  getContacts(body?: ListOfIdsDto): Promise<Array<ContactDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/byIds` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get an empty content
   */
  getEmptyContent(): Promise<ContentDto | any> {
    let _body = null

    const _url = this.host + `/contact/service/content/empty` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new ContentDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get the list of all used codes frequencies in services
   * @param codeType
   * @param minOccurences
   */
  getServiceCodesOccurences(
    codeType: string,
    minOccurences: number
  ): Promise<Array<LabelledOccurenceDto> | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/service/codes/${encodeURIComponent(String(codeType))}/${encodeURIComponent(
        String(minOccurences)
      )}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new LabelledOccurenceDto(it)))
      .catch(err => this.handleError(err))
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
  listContactsByOpeningDate(
    startKey: number,
    endKey: number,
    hcpartyid: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListContactDto | any> {
    let _body = null

    const _url =
      this.host +
      `/contact/byOpeningDate` +
      "?ts=" +
      new Date().getTime() +
      (startKey ? "&startKey=" + encodeURIComponent(String(startKey)) : "") +
      (endKey ? "&endKey=" + encodeURIComponent(String(endKey)) : "") +
      (hcpartyid ? "&hcpartyid=" + encodeURIComponent(String(hcpartyid)) : "") +
      (startDocumentId ? "&startDocumentId=" + encodeURIComponent(String(startDocumentId)) : "") +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new PaginatedListContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of contacts matching the provided filter for the current user (HcParty)
   * @param body
   */
  matchContactsBy(body?: AbstractFilterDtoContact): Promise<Array<string> | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/match` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }

  /**
   * Returns the modified contact.
   * @summary Modify a contact
   * @param body
   */
  modifyContact(body?: ContactDto): Promise<ContactDto | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new ContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Returns the modified contacts.
   * @summary Modify a batch of contacts
   * @param body
   */
  modifyContacts(body?: Array<ContactDto>): Promise<Array<ContactDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/batch` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * It delegates a contact to a healthcare party (By current healthcare party). Returns the contact with new delegations.
   * @summary Delegates a contact to a healthcare party
   * @param body
   * @param contactId
   */
  newContactDelegations(contactId: string, body?: DelegationDto): Promise<ContactDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/contact/${encodeURIComponent(String(contactId))}/delegate` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new ContactDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in healthElements.
   * @param body
   */
  setContactsDelegations(body?: Array<IcureStubDto>): Promise<Array<ContactDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + `/contact/delegations` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new ContactDto(it)))
      .catch(err => this.handleError(err))
  }
}
