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
import { AbstractFilterHealthElement } from '../model/AbstractFilterHealthElement'
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainHealthElement } from '../model/FilterChainHealthElement'
import { HealthElement } from '../model/HealthElement'
import { IcureStub } from '../model/IcureStub'
import { ListOfIds } from '../model/ListOfIds'
import { PaginatedListHealthElement } from '../model/PaginatedListHealthElement'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { MinimalEntityBulkShareResult } from '../model/requests/MinimalEntityBulkShareResult'
import { BulkShareOrUpdateMetadataParams } from '../model/requests/BulkShareOrUpdateMetadataParams'

export class IccHelementApi {
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

  setHeaders(h: Array<XHR.Header>) {
    this._headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Returns an instance of created healthcare element.
   * @summary Create a healthcare element with the current user
   * @param body
   */
  async createHealthElement(body?: HealthElement): Promise<HealthElement> {
    const _url = this.host + `/helement` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthElement(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the created healthcare elements.
   * @summary Create a batch of healthcare elements
   * @param body
   */
  async createHealthElements(body?: Array<HealthElement>): Promise<Array<HealthElement>> {
    const _url = this.host + `/helement/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthElement(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Delete healthcare elements by batch.
   *
   * @param healthElementIds a ListOfIds containing the ids of the health elements to delete.
   * @return a Promise that will resolve in an Array containing the DocIdentifiers of the successfully delete documents.
   */
  async deleteHealthElements(healthElementIds: ListOfIds): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/helement/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      healthElementIds,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single health element by id.
   *
   * @param healthElementId the id of the health element to delete.
   * @return a Promise that will resolve in the DocIdentifier of the deleted health element.
   */
  async deleteHealthElement(healthElementId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/helement/${encodeURIComponent(healthElementId)}` + '?ts=' + new Date().getTime(),
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
   * Returns a list of health elements along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter health elements for the current user (HcParty)
   * @param body
   * @param startDocumentId A HealthElement document ID
   * @param limit Number of rows
   */
  async filterHealthElementsBy(startDocumentId?: string, limit?: number, body?: FilterChainHealthElement): Promise<PaginatedListHealthElement> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/helement/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListHealthElement(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary List healthcare elements found By Healthcare Party and secret foreign keys.
   * @param body
   * @param hcPartyId
   */
  async findHealthElementsByHCPartyPatientForeignKeysUsingPost(hcPartyId: string, body?: Array<string>): Promise<Array<HealthElement>> {
    const _url =
      this.host +
      `/helement/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthElement(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by commas.
   * @summary List healthcare elements found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  async findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<HealthElement>> {
    let _body = null

    const _url =
      this.host +
      `/helement/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthElement(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary List HealthElement ids by data owner and a set of secret foreign key. The ids will be sorted by HealthElement openingDate, in ascending or descending
   * order according to the specified parameter value.
   *
   * @param dataOwnerId the data owner id.
   * @param secretFKeys an array of secret foreign keys.
   * @param startDate a timestamp in epoch milliseconds. If undefined, all the health element ids since the beginning of time will be returned.
   * @param endDate a timestamp in epoch milliseconds. If undefined, all the health element ids until the end of time will be returned.
   * @param descending whether to return the ids ordered in ascending or descending order by HealthElement openingDate
   * @return a promise that will resolve in an Array of HealthElement ids.
   */
  async findHealthElementIdsByDataOwnerPatientOpeningDate(
    dataOwnerId: string,
    secretFKeys: string[],
    startDate?: number,
    endDate?: number,
    descending?: boolean
  ): Promise<string[]> {
    const _url =
      this.host +
      `/helement/byDataOwnerPatientOpeningDate?ts=${new Date().getTime()}` +
      '&dataOwnerId=' +
      encodeURIComponent(dataOwnerId) +
      (!!startDate ? `&startDate=${encodeURIComponent(startDate)}` : '') +
      (!!endDate ? `&endDate=${encodeURIComponent(endDate)}` : '') +
      (!!descending ? `&descending=${descending}` : '')
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    const body = new ListOfIds({ ids: secretFKeys })
    return XHR.sendCommand('POST', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List helement stubs found By Healthcare Party and secret foreign keys.
   * @param body
   * @param hcPartyId
   */
  async findHealthElementsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(hcPartyId: string, body?: Array<string>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/helement/byHcPartySecretForeignKeys/delegations` +
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
   * Keys must be delimited by coma
   * @summary List helement stubs found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  async findHealthElementsDelegationsStubsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<IcureStub>> {
    let _body = null

    const _url =
      this.host +
      `/helement/byHcPartySecretForeignKeys/delegations` +
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
   *
   * @summary Get a healthcare element
   * @param healthElementId
   */
  async getHealthElement(healthElementId: string): Promise<HealthElement> {
    let _body = null

    const _url = this.host + `/helement/${encodeURIComponent(String(healthElementId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthElement(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a list of healthElement by ids/keys.
   * @summary Get healthElements by batch
   * @param body
   */
  async getHealthElements(body?: ListOfIds): Promise<Array<HealthElement>> {
    let _body = null
    _body = body

    const _url = this.host + `/helement/byIds` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthElement(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of health element matching the provided filter for the current user (HcParty)
   * @param body
   */
  async matchHealthElementsBy(body?: AbstractFilterHealthElement): Promise<Array<string>> {
    const _url = this.host + `/helement/match` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified healthcare element.
   * @summary Modify a healthcare element
   * @param body
   */
  async modifyHealthElement(body?: HealthElement): Promise<HealthElement> {
    let _body = null
    _body = body

    const _url = this.host + `/helement` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new HealthElement(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified healthcare elements.
   * @summary Modify a batch of healthcare elements
   * @param body
   */
  async modifyHealthElements(body?: Array<HealthElement>): Promise<Array<HealthElement>> {
    let _body = null
    _body = body

    const _url = this.host + `/helement/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new HealthElement(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareHealthElements(request: BulkShareOrUpdateMetadataParams): Promise<EntityBulkShareResult<HealthElement>[]> {
    const _url = this.host + '/helement/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<HealthElement>(x, HealthElement)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareHealthElementsMinimal(request: BulkShareOrUpdateMetadataParams): Promise<MinimalEntityBulkShareResult[]> {
    const _url = this.host + '/helement/bulkSharedMetadataUpdateMinimal' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new MinimalEntityBulkShareResult(x)))
      .catch((err) => this.handleError(err))
  }
}
