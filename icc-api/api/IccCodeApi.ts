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
import { AbstractFilterCode } from '../model/AbstractFilterCode'
import { Code } from '../model/Code'
import { FilterChainCode } from '../model/FilterChainCode'
import { PaginatedListCode } from '../model/PaginatedListCode'
import { Unit } from '../model/Unit'
import { AuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccCodeApi {
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
   * Create a code entity. Fields Type, Code and Version are required.
   * @summary Create a code
   * @param body
   */
  createCode(body?: Code): Promise<Code> {
    let _body = null
    _body = body

    const _url = this.host + `/code` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Code(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a batch of code entities. Fields Type, Code and Version are required for each code.
   * @summary Create a batch of codes
   * @param body
   */
  createCodes(body?: Array<Code>): Promise<Array<Code>> {
    let _body = null
    _body = body

    const _url = this.host + `/code/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Code(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter codes
   * @param body
   * @param startKey The start key for pagination, depends on the filters used
   * @param startDocumentId A patient document ID
   * @param limit Number of rows
   * @param skip Skip rows
   * @param sort Sort key
   * @param desc Descending
   */
  filterCodesBy(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    skip?: number,
    sort?: string,
    desc?: boolean,
    body?: FilterChainCode
  ): Promise<PaginatedListCode> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/code/filter` +
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
      .then((doc) => new PaginatedListCode(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of code types matched with given input.
   * @summary Get list of code types by region and type.
   * @param region Code region
   * @param type Code type
   */
  findCodeTypes(region?: string, type?: string): Promise<Array<string>> {
    let _body = null

    const _url =
      this.host +
      `/code/codetype/byRegionType` +
      '?ts=' +
      new Date().getTime() +
      (region ? '&region=' + encodeURIComponent(String(region)) : '') +
      (type ? '&type=' + encodeURIComponent(String(type)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input.
   * @summary Gets list of codes by code, type and version
   * @param region Code region
   * @param type Code type
   * @param code Code code
   * @param version Code version
   */
  findCodes(region?: string, type?: string, code?: string, version?: string): Promise<Array<Code>> {
    let _body = null

    const _url =
      this.host +
      `/code/byRegionTypeCode` +
      '?ts=' +
      new Date().getTime() +
      (region ? '&region=' + encodeURIComponent(String(region)) : '') +
      (type ? '&type=' + encodeURIComponent(String(type)) : '') +
      (code ? '&code=' + encodeURIComponent(String(code)) : '') +
      (version ? '&version=' + encodeURIComponent(String(version)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Code(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input.
   * @summary Gets paginated list of codes by code, type and version.
   * @param region
   * @param type
   * @param code
   * @param version
   * @param startKey The start key for pagination
   * @param startDocumentId A code document ID
   * @param limit Number of rows
   */
  findPaginatedCodes(
    region?: string,
    type?: string,
    code?: string,
    version?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListCode> {
    let _body = null

    const _url =
      this.host +
      `/code` +
      '?ts=' +
      new Date().getTime() +
      (region ? '&region=' + encodeURIComponent(String(region)) : '') +
      (type ? '&type=' + encodeURIComponent(String(type)) : '') +
      (code ? '&code=' + encodeURIComponent(String(code)) : '') +
      (version ? '&version=' + encodeURIComponent(String(version)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListCode(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, pagination is not supported
   * @summary Get paginated list of codes by code, type and version.
   * @param region
   * @param types
   * @param language
   * @param label
   * @param version
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A code document ID
   * @param limit Number of rows
   */
  findPaginatedCodesByLabel(
    region?: string,
    types?: string,
    language?: string,
    label?: string,
    version?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListCode> {
    let _body = null

    const _url =
      this.host +
      `/code/byLabel` +
      '?ts=' +
      new Date().getTime() +
      (region ? '&region=' + encodeURIComponent(String(region)) : '') +
      (types ? '&types=' + encodeURIComponent(String(types)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (label ? '&label=' + encodeURIComponent(String(label)) : '') +
      (version ? '&version=' + encodeURIComponent(String(version)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListCode(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input.
   * @summary Gets paginated list of codes by link and link type.
   * @param linkType
   * @param linkedId
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A code document ID
   * @param limit Number of rows
   */
  findPaginatedCodesWithLink(
    linkType: string,
    linkedId?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListCode> {
    let _body = null

    const _url =
      this.host +
      `/code/link/${encodeURIComponent(String(linkType))}` +
      '?ts=' +
      new Date().getTime() +
      (linkedId ? '&linkedId=' + encodeURIComponent(String(linkedId)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListCode(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of tag types matched with given input.
   * @summary Gets list of tag types by region and type.
   * @param region Code region
   * @param type Code type
   */
  findTagTypes(region?: string, type?: string): Promise<Array<string>> {
    let _body = null

    const _url =
      this.host +
      `/code/tagtype/byRegionType` +
      '?ts=' +
      new Date().getTime() +
      (region ? '&region=' + encodeURIComponent(String(region)) : '') +
      (type ? '&type=' + encodeURIComponent(String(type)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a code based on its id
   * @summary Get a code by id
   * @param codeId Code id
   */
  getCode(codeId: string): Promise<Code> {
    let _body = null

    const _url = this.host + `/code/${encodeURIComponent(String(codeId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Code(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a code based on (type, code, version) as query strings. (type, code, version) is unique.
   * @summary Get a code
   * @param type Code type
   * @param code Code code
   * @param version Code version
   */
  getCodeWithParts(type: string, code: string, version: string): Promise<Code> {
    let _body = null

    const _url =
      this.host +
      `/code/${encodeURIComponent(String(type))}/${encodeURIComponent(String(code))}/${encodeURIComponent(String(version))}` +
      '?ts=' +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Code(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a list of codes by ids/keys. Keys must be delimited by coma
   * @summary Gets a list of codes by ids
   * @param codeIds
   */
  getCodes(codeIds: string): Promise<Array<Code>> {
    let _body = null

    const _url = this.host + `/code/byIds/${encodeURIComponent(String(codeIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Code(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Import codes from the resources XML file depending on the passed pathVariable
   * @summary Import codes
   * @param codeType
   */
  importCodes(codeType: string): Promise<Unit> {
    let _body = null

    const _url = this.host + `/code/${encodeURIComponent(String(codeType))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Unit(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get ids of code matching the provided filter for the current user (HcParty)
   * @param body
   */
  matchCodesBy(body?: AbstractFilterCode): Promise<Array<string>> {
    let _body = null
    _body = body

    const _url = this.host + `/code/match` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Modification of (type, code, version) is not allowed.
   * @summary Modify a code
   * @param body
   */
  modifyCode(body?: Code): Promise<Code> {
    let _body = null
    _body = body

    const _url = this.host + `/code` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Code(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Modification of (type, code, version) is not allowed.
   * @summary Modify a batch of codes
   * @param body
   */
  modifyCodes(body?: Array<Code>): Promise<Array<Code>> {
    let _body = null
    _body = body

    const _url = this.host + `/code/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Code(it)))
      .catch((err) => this.handleError(err))
  }
}
