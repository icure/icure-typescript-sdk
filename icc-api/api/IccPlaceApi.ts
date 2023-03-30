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
import { Place } from '../model/Place'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'

export class IccPlaceApi {
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
   *
   * @summary Creates a place
   * @param body
   */
  createPlace(body?: Place): Promise<Place> {
    let _body = null
    _body = body

    const _url = this.host + `/place` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Place(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an place
   * @param placeIds
   */
  deletePlace(placeIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/place/${encodeURIComponent(String(placeIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an place
   * @param placeId
   */
  getPlace(placeId: string): Promise<Place> {
    let _body = null

    const _url = this.host + `/place/${encodeURIComponent(String(placeId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Place(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all places
   */
  getPlaces(): Promise<Array<Place>> {
    let _body = null

    const _url = this.host + `/place` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Place(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an place
   * @param body
   */
  modifyPlace(body?: Place): Promise<Place> {
    let _body = null
    _body = body

    const _url = this.host + `/place` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Place(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
