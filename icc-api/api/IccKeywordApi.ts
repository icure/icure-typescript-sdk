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
import { DocIdentifier } from '../model/DocIdentifier'
import { Keyword } from '../model/Keyword'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { ApiVersion, getApiVersionFromUrl } from '../utils/api-version'
import { ListOfIds } from '../model/ListOfIds'

export class IccKeywordApi {
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
   * Returns an instance of created keyword.
   * @summary Create a keyword with the current user
   * @param body
   */
  createKeyword(body?: Keyword): Promise<Keyword> {
    let _body = null
    _body = body

    const _url = this.host + `/keyword` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Keyword(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of keywords.
   * @param keywordIds an array containing the ids of the keywords to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully delete keywords.
   */
  deleteKeywords(keywordIds: string[]): Promise<Array<DocIdentifier>> {
    const response =
      getApiVersionFromUrl(this.host) == ApiVersion.V1
        ? XHR.sendCommand(
            'DELETE',
            this.host + `/keyword/${encodeURIComponent(keywordIds.join(','))}` + '?ts=' + new Date().getTime(),
            this.headers,
            null,
            this.fetchImpl,
            undefined,
            this.authenticationProvider.getAuthService()
          )
        : XHR.sendCommand(
            'POST',
            this.host + `/keyword/delete/batch` + '?ts=' + new Date().getTime(),
            this.headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json')),
            new ListOfIds({ ids: keywordIds }),
            this.fetchImpl,
            undefined,
            this.authenticationProvider.getAuthService()
          )

    return response.then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it))).catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a keyword
   * @param keywordId
   */
  getKeyword(keywordId: string): Promise<Keyword> {
    let _body = null

    const _url = this.host + `/keyword/${encodeURIComponent(String(keywordId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Keyword(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all keywords
   */
  getKeywords(): Promise<Array<Keyword>> {
    let _body = null

    const _url = this.host + `/keyword` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Keyword(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get keywords by user
   * @param userId
   */
  getKeywordsByUser(userId: string): Promise<Array<Keyword>> {
    let _body = null

    const _url = this.host + `/keyword/byUser/${encodeURIComponent(String(userId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Keyword(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified keyword.
   * @summary Modify a keyword
   * @param body
   */
  modifyKeyword(body?: Keyword): Promise<Keyword> {
    let _body = null
    _body = body

    const _url = this.host + `/keyword` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Keyword(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
