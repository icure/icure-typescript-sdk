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
import { CalendarItem } from '../model/CalendarItem'
import { DocIdentifier } from '../model/DocIdentifier'
import { IcureStub } from '../model/IcureStub'
import { ListOfIds } from '../model/ListOfIds'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccCalendarItemApi {
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
   * @summary Creates a calendarItem
   * @param body
   */
  createCalendarItem(body?: CalendarItem): Promise<CalendarItem> {
    let _body = null
    _body = body

    const _url = this.host + `/calendarItem` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new CalendarItem(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an calendarItem
   * @param calendarItemIds
   */
  deleteCalendarItem(calendarItemIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/calendarItem/${encodeURIComponent(String(calendarItemIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes calendarItems
   * @param body
   */
  deleteCalendarItems(body?: ListOfIds): Promise<Array<DocIdentifier>> {
    let _body = null
    _body = body

    const _url = this.host + `/calendarItem/delete/byIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Find CalendarItems by hcparty and patient
   * @param hcPartyId
   * @param secretFKeys
   */
  findCalendarItemsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<CalendarItem>> {
    let _body = null

    const _url =
      this.host +
      `/calendarItem/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Find CalendarItems by recurrenceId
   * @param recurrenceId
   */
  findCalendarItemsByRecurrenceId(recurrenceId: string): Promise<Array<CalendarItem>> {
    let _body = null

    const _url =
      this.host +
      `/calendarItem/byRecurrenceId` +
      '?ts=' +
      new Date().getTime() +
      (recurrenceId ? '&recurrenceId=' + encodeURIComponent(String(recurrenceId)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an calendarItem
   * @param calendarItemId
   */
  getCalendarItem(calendarItemId: string): Promise<CalendarItem> {
    let _body = null

    const _url = this.host + `/calendarItem/${encodeURIComponent(String(calendarItemId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new CalendarItem(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all calendarItems
   */
  getCalendarItems(): Promise<Array<CalendarItem>> {
    let _body = null

    const _url = this.host + `/calendarItem` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get CalendarItems by Period and HcPartyId
   * @param startDate
   * @param endDate
   * @param hcPartyId
   */
  getCalendarItemsByPeriodAndHcPartyId(startDate: number, endDate: number, hcPartyId: string): Promise<Array<CalendarItem>> {
    let _body = null

    const _url =
      this.host +
      `/calendarItem/byPeriodAndHcPartyId` +
      '?ts=' +
      new Date().getTime() +
      (startDate ? '&startDate=' + encodeURIComponent(String(startDate)) : '') +
      (endDate ? '&endDate=' + encodeURIComponent(String(endDate)) : '') +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get calendarItems by id
   * @param body
   */
  getCalendarItemsWithIds(body?: ListOfIds): Promise<Array<CalendarItem>> {
    let _body = null
    _body = body

    const _url = this.host + `/calendarItem/byIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get CalendarItems by Period and AgendaId
   * @param startDate
   * @param endDate
   * @param agendaId
   */
  getCalendarsByPeriodAndAgendaId(startDate: number, endDate: number, agendaId: string): Promise<Array<CalendarItem>> {
    let _body = null

    const _url =
      this.host +
      `/calendarItem/byPeriodAndAgendaId` +
      '?ts=' +
      new Date().getTime() +
      (startDate ? '&startDate=' + encodeURIComponent(String(startDate)) : '') +
      (endDate ? '&endDate=' + encodeURIComponent(String(endDate)) : '') +
      (agendaId ? '&agendaId=' + encodeURIComponent(String(agendaId)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an calendarItem
   * @param body
   */
  modifyCalendarItem(body?: CalendarItem): Promise<CalendarItem> {
    let _body = null
    _body = body

    const _url = this.host + `/calendarItem` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new CalendarItem(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Update delegations in calendarItems
   * @param body
   */
  setCalendarItemsDelegations(body?: Array<IcureStub>): Promise<Array<CalendarItem>> {
    let _body = null
    _body = body

    const _url = this.host + `/calendarItem/delegations` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CalendarItem(it)))
      .catch((err) => this.handleError(err))
  }
}
