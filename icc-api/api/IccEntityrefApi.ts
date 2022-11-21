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
import { EntityReference } from '../model/EntityReference'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccEntityrefApi {
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
    this.host = host
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
   * @summary Create an entity reference
   * @param body
   */
  createEntityReference(body?: EntityReference): Promise<EntityReference> {
    let _body = null
    _body = body

    const _url = this.host + `/entityref` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new EntityReference(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Find latest reference for a prefix
   * @param prefix
   */
  getLatest(prefix: string): Promise<EntityReference> {
    let _body = null

    const _url = this.host + `/entityref/latest/${encodeURIComponent(String(prefix))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new EntityReference(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
