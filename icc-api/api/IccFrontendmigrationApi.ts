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
import { FrontEndMigration } from '../model/FrontEndMigration'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'

export class IccFrontendmigrationApi {
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
   * @summary Creates a front end migration
   * @param body
   */
  createFrontEndMigration(body?: FrontEndMigration): Promise<FrontEndMigration> {
    let _body = null
    _body = body

    const _url = this.host + `/frontendmigration` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FrontEndMigration(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes a front end migration
   * @param frontEndMigrationId
   */
  deleteFrontEndMigration(frontEndMigrationId: string): Promise<DocIdentifier> {
    let _body = null

    const _url = this.host + `/frontendmigration/${encodeURIComponent(String(frontEndMigrationId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocIdentifier(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a front end migration
   * @param frontEndMigrationId
   */
  getFrontEndMigration(frontEndMigrationId: string): Promise<FrontEndMigration> {
    let _body = null

    const _url = this.host + `/frontendmigration/${encodeURIComponent(String(frontEndMigrationId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FrontEndMigration(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an front end migration
   * @param frontEndMigrationName
   */
  getFrontEndMigrationByName(frontEndMigrationName: string): Promise<Array<FrontEndMigration>> {
    let _body = null

    const _url = this.host + `/frontendmigration/byName/${encodeURIComponent(String(frontEndMigrationName))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new FrontEndMigration(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a front end migration
   */
  getFrontEndMigrations(): Promise<Array<FrontEndMigration>> {
    let _body = null

    const _url = this.host + `/frontendmigration` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new FrontEndMigration(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies a front end migration
   * @param body
   */
  modifyFrontEndMigration(body?: FrontEndMigration): Promise<FrontEndMigration> {
    let _body = null
    _body = body

    const _url = this.host + `/frontendmigration` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FrontEndMigration(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
