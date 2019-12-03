/**
 *
 * No description provided (generated by Swagger Codegen https://github.com/swagger-api/swagger-codegen)
 *
 * OpenAPI spec version: 1.0.2
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { XHR } from "./XHR"
import * as models from "../model/models"

export class iccCalendarItemApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.Data) {
    if (e.status == 401) throw Error("auth-failed")
    else throw Error("api-error" + e.status)
  }

  createCalendarItem(body?: models.CalendarItemDto): Promise<models.CalendarItemDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/calendarItem" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.CalendarItemDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  deleteCalendarItem(calendarItemIds: string): Promise<any | Boolean> {
    let _body = null

    const _url =
      this.host +
      "/calendarItem/{calendarItemIds}".replace("{calendarItemIds}", calendarItemIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => true)
      .catch(err => this.handleError(err))
  }
  findByHCPartyPatientSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.CalendarItemDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/calendarItem/byHcPartySecretForeignKeys" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.CalendarItemDto(it)))
      .catch(err => this.handleError(err))
  }
  getCalendarItem(calendarItemId: string): Promise<models.CalendarItemDto | any> {
    let _body = null

    const _url =
      this.host +
      "/calendarItem/{calendarItemId}".replace("{calendarItemId}", calendarItemId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.CalendarItemDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getCalendarItems(): Promise<Array<models.CalendarItemDto> | any> {
    let _body = null

    const _url = this.host + "/calendarItem" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.CalendarItemDto(it)))
      .catch(err => this.handleError(err))
  }
  getCalendarItemsByPeriodAndHcPartyId(
    startDate?: number,
    endDate?: number,
    hcPartyId?: string
  ): Promise<Array<models.CalendarItemDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/calendarItem/byPeriodAndHcPartyId" +
      "?ts=" +
      new Date().getTime() +
      (startDate ? "&startDate=" + startDate : "") +
      (endDate ? "&endDate=" + endDate : "") +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.CalendarItemDto(it)))
      .catch(err => this.handleError(err))
  }
  getCalendarsByPeriodAndAgendaId(
    startDate?: number,
    endDate?: number,
    agendaId?: string
  ): Promise<Array<models.CalendarItemDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/calendarItem/byPeriodAndAgendaId" +
      "?ts=" +
      new Date().getTime() +
      (startDate ? "&startDate=" + startDate : "") +
      (endDate ? "&endDate=" + endDate : "") +
      (agendaId ? "&agendaId=" + agendaId : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.CalendarItemDto(it)))
      .catch(err => this.handleError(err))
  }
  modifyCalendarItem(body?: models.CalendarItemDto): Promise<models.CalendarItemDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/calendarItem" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.CalendarItemDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
