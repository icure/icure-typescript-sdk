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
import { AuthenticationResponse } from '../model/AuthenticationResponse'
import { LoginCredentials } from '../model/LoginCredentials'

export class IccAuthApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(host: string, headers: any, fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
    this.host = host
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Login using username and password
   * @summary login
   * @param body
   */
  login(body?: LoginCredentials): Promise<AuthenticationResponse> {
    let _body = null
    _body = body

    const _url = this.host + `/auth/login` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Logout
   * @summary logout
   */
  logout(): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/logout` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand(
      'GET',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Logout
   * @summary logout
   */
  logoutPost(): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/logout` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand(
      'POST',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get token for subsequent operation
   * @summary token
   * @param method
   * @param path
   */
  token(method: string, path: string): Promise<string> {
    let _body = null

    const _url = this.host + `/auth/token/${encodeURIComponent(String(method))}/${encodeURIComponent(String(path))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }
}
