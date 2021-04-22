/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from './XHR'
import { DocIdentifier } from '../model/DocIdentifier'
import { TimeTable } from '../model/TimeTable'

export class IccTimeTableApi {
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
   *
   * @summary Creates a timeTable
   * @param body
   */
  createTimeTable(body?: TimeTable): Promise<TimeTable> {
    let _body = null
    _body = body

    const _url = this.host + `/timeTable` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new TimeTable(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an timeTable
   * @param timeTableIds
   */
  deleteTimeTable(timeTableIds: string): Promise<Array<DocIdentifier>> {
    const _body = null

    const _url = this.host + `/timeTable/${encodeURIComponent(String(timeTableIds))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a timeTable
   * @param timeTableId
   */
  getTimeTable(timeTableId: string): Promise<TimeTable> {
    const _body = null

    const _url = this.host + `/timeTable/${encodeURIComponent(String(timeTableId))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new TimeTable(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get TimeTables by AgendaId
   * @param agendaId
   */
  getTimeTablesByAgendaId(agendaId: string): Promise<Array<TimeTable>> {
    const _body = null

    const _url =
      this.host + `/timeTable/byAgendaId` + '?ts=' + new Date().getTime() + (agendaId ? '&agendaId=' + encodeURIComponent(String(agendaId)) : '')
    const headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new TimeTable(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get TimeTables by Period and AgendaId
   * @param startDate
   * @param endDate
   * @param agendaId
   */
  getTimeTablesByPeriodAndAgendaId(startDate: number, endDate: number, agendaId: string): Promise<Array<TimeTable>> {
    const _body = null

    const _url =
      this.host +
      `/timeTable/byPeriodAndAgendaId` +
      '?ts=' +
      new Date().getTime() +
      (startDate ? '&startDate=' + encodeURIComponent(String(startDate)) : '') +
      (endDate ? '&endDate=' + encodeURIComponent(String(endDate)) : '') +
      (agendaId ? '&agendaId=' + encodeURIComponent(String(agendaId)) : '')
    const headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new TimeTable(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an timeTable
   * @param body
   */
  modifyTimeTable(body?: TimeTable): Promise<TimeTable> {
    let _body = null
    _body = body

    const _url = this.host + `/timeTable` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new TimeTable(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
