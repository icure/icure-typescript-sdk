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
import { AbstractFilterHealthcareParty } from '../model/AbstractFilterHealthcareParty'
import { DataOwnerRegistrationSuccess } from '../model/DataOwnerRegistrationSuccess'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainHealthcareParty } from '../model/FilterChainHealthcareParty'
import { HealthcareParty } from '../model/HealthcareParty'
import { ListOfIds } from '../model/ListOfIds'
import { PaginatedListHealthcareParty } from '../model/PaginatedListHealthcareParty'
import { PublicKey } from '../model/PublicKey'
import { AuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccHcpartyApi {
  host: string
  headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    authenticationProvider: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = authenticationProvider
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * One of Name or Last name+First name, Nihii, and Public key are required.
   * @summary Create a healthcare party
   * @param body
   */
  createHealthcareParty(body?: HealthcareParty): Promise<HealthcareParty> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * One of Name or Last name+First name, Nihii, and Public key are required.
   * @summary Create a healthcare party
   * @param body
   * @param groupId
   */
  createHealthcarePartyInGroup(groupId: string, body?: HealthcareParty): Promise<HealthcareParty> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty/inGroup/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Deleting a healthcareParty. Response is an array containing the id of deleted healthcare party.
   * @summary Delete a healthcare party
   * @param healthcarePartyIds
   */
  deleteHealthcareParties(healthcarePartyIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(healthcarePartyIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Deleting a healthcareParty. Response is an array containing the id of deleted healthcare party.
   * @summary Delete a healthcare party
   * @param groupId
   * @param healthcarePartyIds
   */
  deleteHealthcarePartiesInGroup(groupId: string, healthcarePartyIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url =
      this.host +
      `/hcparty/inGroup/${encodeURIComponent(String(groupId))}/${encodeURIComponent(String(healthcarePartyIds))}` +
      '?ts=' +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare party along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter healthcare parties for the current user (HcParty)
   * @param body
   * @param startDocumentId A HealthcareParty document ID
   * @param limit Number of rows
   */
  filterHealthPartiesBy(startDocumentId?: string, limit?: number, body?: FilterChainHealthcareParty): Promise<PaginatedListHealthcareParty> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/hcparty/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare parties.
   * @summary Find healthcare parties by name with(out) pagination
   * @param name The Last name search value
   * @param startKey A healthcare party Last name
   * @param startDocumentId A healthcare party document ID
   * @param limit Number of rows
   * @param desc Descending
   */
  findByName(name?: string, startKey?: string, startDocumentId?: string, limit?: number, desc?: boolean): Promise<PaginatedListHealthcareParty> {
    let _body = null

    const _url =
      this.host +
      `/hcparty/byName` +
      '?ts=' +
      new Date().getTime() +
      (name ? '&name=' + encodeURIComponent(String(name)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (desc ? '&desc=' + encodeURIComponent(String(desc)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare parties.
   * @summary Find healthcare parties by name with(out) pagination
   * @param type The type of the HCP (persphysician)
   * @param spec The speciality of the HCP
   * @param firstCode The first postCode for the HCP
   * @param lastCode The last postCode for the HCP
   * @param limit Number of rows
   */
  findBySpecialityAndPostCode(
    type: string,
    spec: string,
    firstCode: string,
    lastCode: string,
    limit?: number
  ): Promise<PaginatedListHealthcareParty> {
    let _body = null

    const _url =
      this.host +
      `/hcparty/bySpecialityAndPostCode/${encodeURIComponent(String(type))}/${encodeURIComponent(String(spec))}/${encodeURIComponent(
        String(firstCode)
      )}/to/${encodeURIComponent(String(lastCode))}` +
      '?ts=' +
      new Date().getTime() +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare parties.
   * @summary Find healthcare parties by nihii or ssin with(out) pagination
   * @param searchValue
   * @param startKey A healthcare party Last name
   * @param startDocumentId A healthcare party document ID
   * @param limit Number of rows
   * @param desc Descending
   */
  findBySsinOrNihii(
    searchValue: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    desc?: boolean
  ): Promise<PaginatedListHealthcareParty> {
    let _body = null

    const _url =
      this.host +
      `/hcparty/byNihiiOrSsin/${encodeURIComponent(String(searchValue))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (desc ? '&desc=' + encodeURIComponent(String(desc)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * (key, value) of the map is as follows: (ID of the owner of the encrypted AES key, encrypted AES keys)
   * @summary Get the HcParty encrypted AES keys indexed by owner.
   * @param healthcarePartyId
   */
  getAesExchangeKeysForDelegate(
    healthcarePartyId: string
  ): Promise<{ [delegateId: string]: { [delegatorPubKeyFingerprint: string]: { [delegatePubKeyFingerprint: string]: string } } }> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(healthcarePartyId))}/aesExchangeKeys` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the current healthcare Party
   * @summary Get the current healthcare party if logged in.
   */
  getCurrentHealthcareParty(): Promise<HealthcareParty> {
    let _body = null

    const _url = this.host + `/hcparty/current` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * (key, value) of the map is as follows: (ID of the owner of the encrypted AES key, encrypted AES key)
   * @summary Get the HcParty encrypted AES keys indexed by owner. As a HCp may now have multiple AES keys, this service is deprecated. Use /{healthcarePartyId}/aesExchangeKeys
   * @param healthcarePartyId
   */
  getHcPartyKeysForDelegate(healthcarePartyId: string): Promise<{ [key: string]: string }> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(healthcarePartyId))}/keys` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the healthcare Party
   * @summary Get healthcareParties by their IDs
   * @param healthcarePartyIds
   */
  getHealthcareParties(healthcarePartyIds: string): Promise<Array<HealthcareParty>> {
    let _body = null

    const _url = this.host + `/hcparty/byIds/${encodeURIComponent(String(healthcarePartyIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthcareParty(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Return a list of children hcp.
   * @summary Find children of an healthcare parties
   * @param parentId
   */
  getHealthcarePartiesByParentId(parentId: string): Promise<Array<HealthcareParty>> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(parentId))}/children` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthcareParty(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the healthcare Party
   * @summary Get healthcareParties by their IDs
   * @param body
   * @param groupId
   */
  getHealthcarePartiesInGroup(groupId: string, body?: ListOfIds): Promise<Array<HealthcareParty>> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty/inGroup/${encodeURIComponent(String(groupId))}/byIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthcareParty(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the healthcare Party
   * @summary Get a healthcareParty by his ID
   * @param healthcarePartyId
   */
  getHealthcareParty(healthcarePartyId: string): Promise<HealthcareParty> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(healthcarePartyId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the public key of a healthcare party in Hex
   * @summary Get public key of a healthcare party
   * @param healthcarePartyId
   */
  getPublicKey(healthcarePartyId: string): Promise<PublicKey> {
    let _body = null

    const _url = this.host + `/hcparty/${encodeURIComponent(String(healthcarePartyId))}/publicKey` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PublicKey(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare parties.
   * @summary Find healthcare parties by name with(out) pagination
   * @param name The Last name search value
   */
  listByName(name: string): Promise<Array<HealthcareParty>> {
    let _body = null

    const _url = this.host + `/hcparty/byNameStrict/${encodeURIComponent(String(name))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthcareParty(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of healthcare parties.
   * @summary List healthcare parties with(out) pagination
   * @param startKey A healthcare party Last name
   * @param startDocumentId A healthcare party document ID
   * @param limit Number of rows
   * @param desc Descending
   */
  listHealthcareParties(startKey?: string, startDocumentId?: string, limit?: number, desc?: boolean): Promise<PaginatedListHealthcareParty> {
    let _body = null

    const _url =
      this.host +
      `/hcparty` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '') +
      (desc ? '&desc=' + encodeURIComponent(String(desc)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of healthcare party matching the provided filter for the current user (HcParty)
   * @param body
   */
  matchHealthcarePartiesBy(body?: AbstractFilterHealthcareParty): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty/match` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * No particular return value. It's just a message.
   * @summary Modify a Healthcare Party.
   * @param body
   */
  modifyHealthcareParty(body?: HealthcareParty): Promise<HealthcareParty> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * No particular return value. It's just a message.
   * @summary Modify a Healthcare Party.
   * @param body
   * @param groupId
   */
  modifyHealthcarePartyInGroup(groupId: string, body?: HealthcareParty): Promise<HealthcareParty> {
    let _body = null
    _body = body

    const _url = this.host + `/hcparty/inGroup/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthcareParty(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Register a new hcp into the system
   * @summary Register a hcp
   * @param body
   * @param groupId
   * @param parentHcPartyId
   * @param token
   * @param useShortToken
   */
  registerHealthcareParty(
    groupId: string,
    parentHcPartyId?: string,
    token?: string,
    useShortToken?: boolean,
    body?: HealthcareParty
  ): Promise<DataOwnerRegistrationSuccess> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/hcparty/register/inGroup/${encodeURIComponent(String(groupId))}` +
      '?ts=' +
      new Date().getTime() +
      (parentHcPartyId ? '&parentHcPartyId=' + encodeURIComponent(String(parentHcPartyId)) : '') +
      (token ? '&token=' + encodeURIComponent(String(token)) : '') +
      (useShortToken ? '&useShortToken=' + encodeURIComponent(String(useShortToken)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DataOwnerRegistrationSuccess(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
