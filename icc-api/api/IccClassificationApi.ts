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
import { Classification } from '../model/Classification'
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { IcureStub } from '../model/IcureStub'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { MinimalEntityBulkShareResult } from '../model/requests/MinimalEntityBulkShareResult'
import { ListOfIds } from '../model/ListOfIds'

export class IccClassificationApi {
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
   * Returns an instance of created classification Template.
   * @summary Create a classification with the current user
   * @param body
   */
  async createClassification(body?: Classification): Promise<Classification> {
    let _body = null
    _body = body

    const _url = this.host + `/classification` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of classifications.
   *
   * @param classificationIds an array containing the ids of the classification to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully deleted classifications.
   */
  async deleteClassifications(classificationIds: string[]): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/classification/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      new ListOfIds({ ids: classificationIds }),
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single classification by id.
   *
   * @param classificationId the id of the classification to delete.
   * @return a Promise that will resolve in the DocIdentifier of the deleted classification.
   */
  async deleteClassification(classificationId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/classification/${encodeURIComponent(classificationId)}` + '?ts=' + new Date().getTime(),
      await this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys hast to delimited by coma
   * @summary List classification Templates found By Healthcare Party and secret foreign keyelementIds.
   * @param hcPartyId
   * @param secretFKeys
   */
  async findClassificationsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<Classification>> {
    let _body = null

    const _url =
      this.host +
      `/classification/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Classification(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a classification Template
   * @param classificationId
   */
  async getClassification(classificationId: string): Promise<Classification> {
    let _body = null

    const _url = this.host + `/classification/${encodeURIComponent(String(classificationId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Ids are seperated by a coma
   * @summary Get a list of classifications
   * @param ids
   */
  async getClassificationByHcPartyId(ids: string): Promise<Array<Classification>> {
    let _body = null

    const _url = this.host + `/classification/byIds/${encodeURIComponent(String(ids))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Classification(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified classification Template.
   * @summary Modify a classification Template
   * @param body
   */
  async modifyClassification(body?: Classification): Promise<Classification> {
    let _body = null
    _body = body

    const _url = this.host + `/classification` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * It delegates a classification to a healthcare party (By current healthcare party). Returns the element with new delegations.
   * @summary Delegates a classification to a healthcare party
   * @param body
   * @param classificationId
   */
  async newClassificationDelegations(classificationId: string, body?: Array<Delegation>): Promise<Classification> {
    let _body = null
    _body = body

    const _url = this.host + `/classification/${encodeURIComponent(String(classificationId))}/delegate` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in classification
   * @param body
   */
  async setClassificationsDelegations(body?: Array<IcureStub>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url = this.host + `/classification/delegations` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareClassifications(request: {
    [entityId: string]: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
  }): Promise<EntityBulkShareResult<Classification>[]> {
    const _url = this.host + '/classification/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<Classification>(x, Classification)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareClassificationsMinimal(request: {
    [entityId: string]: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
  }): Promise<MinimalEntityBulkShareResult[]> {
    const _url = this.host + '/classification/bulkSharedMetadataUpdateMinimal' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new MinimalEntityBulkShareResult(x)))
      .catch((err) => this.handleError(err))
  }
}
