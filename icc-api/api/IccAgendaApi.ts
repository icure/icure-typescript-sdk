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
import { Agenda } from '../model/Agenda'
import { DocIdentifier } from '../model/DocIdentifier'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { ApiVersion, getApiVersionFromUrl } from '../utils/api-version'
import { ListOfIds } from '../model/ListOfIds'

export class IccAgendaApi {
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
   * @summary Creates a agenda
   * @param body
   */
  createAgenda(body?: Agenda): Promise<Agenda> {
    let _body = null
    _body = body

    const _url = this.host + `/agenda` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Agenda(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Delete a batch of agendas by id.
   *
   * @param agendaIds an array containing the ids of the agendas to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully deleted agendas.
   */
  deleteAgendas(agendaIds: string[]): Promise<Array<DocIdentifier>> {
    const response =
      getApiVersionFromUrl(this.host) == ApiVersion.V1
        ? XHR.sendCommand(
            'DELETE',
            this.host + `/agenda/${encodeURIComponent(agendaIds.join(','))}` + '?ts=' + new Date().getTime(),
            this.headers,
            null,
            this.fetchImpl,
            undefined,
            this.authenticationProvider.getAuthService()
          )
        : XHR.sendCommand(
            'POST',
            this.host + `/agenda/delete/batch` + '?ts=' + new Date().getTime(),
            this.headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json')),
            new ListOfIds({ ids: agendaIds }),
            this.fetchImpl,
            undefined,
            this.authenticationProvider.getAuthService()
          )

    return response.then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it))).catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single agenda by id.
   *
   * @param agendaId the id of the agenda to delete.
   * @return a Promise that will resolve in the DocIdentifier of the deleted agenda.
   */
  deleteAgenda(agendaId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/agenda/${encodeURIComponent(agendaId)}` + '?ts=' + new Date().getTime(),
      this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an agenda
   * @param agendaId
   */
  getAgenda(agendaId: string): Promise<Agenda> {
    let _body = null

    const _url = this.host + `/agenda/${encodeURIComponent(String(agendaId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Agenda(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all agendas
   */
  getAgendas(): Promise<Array<Agenda>> {
    let _body = null

    const _url = this.host + `/agenda` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Agenda(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all agendas for user
   * @param userId
   */
  getAgendasForUser(userId: string): Promise<Agenda> {
    let _body = null

    const _url = this.host + `/agenda/byUser` + '?ts=' + new Date().getTime() + (userId ? '&userId=' + encodeURIComponent(String(userId)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Agenda(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets readable agendas for user
   * @param userId
   */
  getReadableAgendasForUser(userId: string): Promise<Array<Agenda>> {
    let _body = null

    const _url =
      this.host + `/agenda/readableForUser` + '?ts=' + new Date().getTime() + (userId ? '&userId=' + encodeURIComponent(String(userId)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Agenda(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an agenda
   * @param body
   */
  modifyAgenda(body?: Agenda): Promise<Agenda> {
    let _body = null
    _body = body

    const _url = this.host + `/agenda` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Agenda(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
