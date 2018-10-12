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

export class iccInvoiceApi {
  host: string
  headers: Array<XHR.Header>
  constructor(host: string, headers: any) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.Data) {
    if (e.status == 401) throw Error("auth-failed")
    else throw Error("api-error" + e.status)
  }

  appendCodes(
    userId: string,
    type: string,
    sentMediumType: string,
    insuranceId?: string,
    secretFKeys?: string,
    invoiceId?: string,
    gracePriod?: number,
    body?: Array<models.InvoicingCodeDto>
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/invoice/byauthor/{userId}/append/{type}/{sentMediumType}"
        .replace("{userId}", userId + "")
        .replace("{type}", type + "")
        .replace("{sentMediumType}", sentMediumType + "") +
      "?ts=" +
      new Date().getTime() +
      (insuranceId ? "&insuranceId=" + insuranceId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "") +
      (invoiceId ? "&invoiceId=" + invoiceId : "") +
      (gracePriod ? "&gracePriod=" + gracePriod : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  createInvoice(body?: models.InvoiceDto): Promise<models.InvoiceDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  deleteInvoice(invoiceId: string): Promise<any | Boolean> {
    let _body = null

    const _url =
      this.host +
      "/invoice/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body)
      .then(doc => (doc.contentType.startsWith("application/octet-stream") ? doc.body : true))
      .catch(err => this.handleError(err))
  }
  findByAuthor(
    userId: string,
    fromDate?: number,
    toDate?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<models.InvoicePaginatedList | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byauthor/{userId}".replace("{userId}", userId + "") +
      "?ts=" +
      new Date().getTime() +
      (fromDate ? "&fromDate=" + fromDate : "") +
      (toDate ? "&toDate=" + toDate : "") +
      (startKey ? "&startKey=" + startKey : "") +
      (startDocumentId ? "&startDocumentId=" + startDocumentId : "") +
      (limit ? "&limit=" + limit : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => new models.InvoicePaginatedList(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  findByHCPartyPatientSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byHcPartySecretForeignKeys" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  findDelegationsStubsByHCPartyPatientSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.IcureStubDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byHcPartySecretForeignKeys/delegations" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.IcureStubDto(it)))
      .catch(err => this.handleError(err))
  }
  getInvoice(invoiceId: string): Promise<models.InvoiceDto | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getInvoices(body?: models.ListOfIdsDto): Promise<Array<models.InvoiceDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice/byIds" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listAllHcpsByStatus(
    status: string,
    from?: number,
    to?: number,
    body?: models.ListOfIdsDto
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/invoice/allHcpsByStatus/{status}".replace("{status}", status + "") +
      "?ts=" +
      new Date().getTime() +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByContactIds(body?: models.ListOfIdsDto): Promise<Array<models.InvoiceDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice/byCtcts" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcPartyEfactToBeCorrected(
    hcPartyId: string,
    from?: number,
    to?: number
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byHcParty/{hcPartyId}/efact/tobecorrected".replace("{hcPartyId}", hcPartyId + "") +
      "?ts=" +
      new Date().getTime() +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcPartyEfactUnsent(
    hcPartyId: string,
    from?: number,
    to?: number
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byHcParty/{hcPartyId}/efact/unsent".replace("{hcPartyId}", hcPartyId + "") +
      "?ts=" +
      new Date().getTime() +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcPartySentMediumTypeInvoiceTypeSentDate(
    hcPartyId: string,
    sentMediumType: string,
    invoiceType: string,
    sent: boolean,
    from?: number,
    to?: number
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byHcParty/{hcPartyId}/mediumType/{sentMediumType}/invoiceType/{invoiceType}/sent/{sent}"
        .replace("{hcPartyId}", hcPartyId + "")
        .replace("{sentMediumType}", sentMediumType + "")
        .replace("{invoiceType}", invoiceType + "")
        .replace("{sent}", sent + "") +
      "?ts=" +
      new Date().getTime() +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByIds(invoiceIds: string): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byIds/{invoiceIds}".replace("{invoiceIds}", invoiceIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByRecipientsIds(recipientIds: string): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/to/{recipientIds}".replace("{recipientIds}", recipientIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByServiceIds(serviceIds: string): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/byServiceIds/{serviceIds}".replace("{serviceIds}", serviceIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToInsurances(userIds?: string): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/toInsurances" +
      "?ts=" +
      new Date().getTime() +
      (userIds ? "&userIds=" + userIds : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToInsurancesUnsent(userIds?: string): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/toInsurances/unsent" +
      "?ts=" +
      new Date().getTime() +
      (userIds ? "&userIds=" + userIds : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToPatients(): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url = this.host + "/invoice/toPatients" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToPatientsUnsent(): Promise<Array<models.InvoiceDto> | any> {
    let _body = null

    const _url = this.host + "/invoice/toPatients/unsent" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  mergeTo(invoiceId: string, body?: models.ListOfIdsDto): Promise<models.InvoiceDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/invoice/mergeTo/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  modifyInvoice(body?: models.InvoiceDto): Promise<models.InvoiceDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  newDelegations(
    invoiceId: string,
    body?: Array<models.DelegationDto>
  ): Promise<models.InvoiceDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/invoice/{invoiceId}/delegate".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  reassignInvoice(body?: models.InvoiceDto): Promise<models.InvoiceDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice/reassign" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  removeCodes(
    userId: string,
    serviceId: string,
    secretFKeys?: string,
    body?: Array<string>
  ): Promise<Array<models.InvoiceDto> | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/invoice/byauthor/{userId}/service/{serviceId}"
        .replace("{userId}", userId + "")
        .replace("{serviceId}", serviceId + "") +
      "?ts=" +
      new Date().getTime() +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  setInvoicesDelegations(body?: Array<models.IcureStubDto>): Promise<any | Boolean> {
    let _body = null
    _body = body

    const _url = this.host + "/invoice/delegations" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => (doc.contentType.startsWith("application/octet-stream") ? doc.body : true))
      .catch(err => this.handleError(err))
  }
  validate(
    invoiceId: string,
    scheme?: string,
    forcedValue?: string
  ): Promise<models.InvoiceDto | any> {
    let _body = null

    const _url =
      this.host +
      "/invoice/validate/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime() +
      (scheme ? "&scheme=" + scheme : "") +
      (forcedValue ? "&forcedValue=" + forcedValue : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => new models.InvoiceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
