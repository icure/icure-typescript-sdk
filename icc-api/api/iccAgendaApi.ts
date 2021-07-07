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
import { XHR } from "./XHR"
import { AgendaDto } from "../model/AgendaDto"
import { DocIdentifier } from "../model/DocIdentifier"

export class iccAgendaApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
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
   * @summary Creates a agenda
   * @param body
   */
  createAgenda(body?: AgendaDto): Promise<AgendaDto> {
    let _body = null
    _body = body

    const _url = this.host + `/agenda` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new AgendaDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an agenda
   * @param agendaIds
   */
  deleteAgenda(agendaIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url =
      this.host + `/agenda/${encodeURIComponent(String(agendaIds))}` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an agenda
   * @param agendaId
   */
  getAgenda(agendaId: string): Promise<AgendaDto> {
    let _body = null

    const _url =
      this.host + `/agenda/${encodeURIComponent(String(agendaId))}` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new AgendaDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all agendas
   */
  getAgendas(): Promise<Array<AgendaDto>> {
    let _body = null

    const _url = this.host + `/agenda` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new AgendaDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all agendas for user
   * @param userId
   */
  getAgendasForUser(userId: string): Promise<AgendaDto> {
    let _body = null

    const _url =
      this.host +
      `/agenda/byUser` +
      "?ts=" +
      new Date().getTime() +
      (userId ? "&userId=" + encodeURIComponent(String(userId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new AgendaDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets readable agendas for user
   * @param userId
   */
  getReadableAgendasForUser(userId: string): Promise<Array<AgendaDto>> {
    let _body = null

    const _url =
      this.host +
      `/agenda/readableForUser` +
      "?ts=" +
      new Date().getTime() +
      (userId ? "&userId=" + encodeURIComponent(String(userId)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new AgendaDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an agenda
   * @param body
   */
  modifyAgenda(body?: AgendaDto): Promise<AgendaDto> {
    let _body = null
    _body = body

    const _url = this.host + `/agenda` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new AgendaDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
