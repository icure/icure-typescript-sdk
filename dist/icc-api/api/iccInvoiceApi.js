"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
const XHR_1 = require("./XHR")
const models = require("../model/models")
class iccInvoiceApi {
  constructor(host, headers, fetchImpl) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR_1.XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }
  setHeaders(h) {
    this.headers = h
  }
  handleError(e) {
    if (e.status == 401) throw Error("auth-failed")
    else throw Error("api-error" + e.status)
  }
  appendCodes(userId, type, sentMediumType, insuranceId, secretFKeys, invoiceId, gracePriod, body) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  createInvoice(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  deleteInvoice(invoiceId) {
    let _body = null
    const _url =
      this.host +
      "/invoice/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => true)
      .catch(err => this.handleError(err))
  }
  filterBy(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice/filter" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }
  findByAuthor(hcPartyId, fromDate, toDate, startKey, startDocumentId, limit) {
    let _body = null
    const _url =
      this.host +
      "/invoice/byauthor/{hcPartyId}".replace("{hcPartyId}", hcPartyId + "") +
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoicePaginatedList(doc.body))
      .catch(err => this.handleError(err))
  }
  findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  findDelegationsStubsByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.IcureStubDto(it)))
      .catch(err => this.handleError(err))
  }
  getInvoice(invoiceId) {
    let _body = null
    const _url =
      this.host +
      "/invoice/{invoiceId}".replace("{invoiceId}", invoiceId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  getInvoices(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice/byIds" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  getTarificationsCodesOccurences(minOccurences) {
    let _body = null
    const _url =
      this.host +
      "/invoice/codes/{minOccurences}".replace("{minOccurences}", minOccurences + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.LabelledOccurenceDto(it)))
      .catch(err => this.handleError(err))
  }
  listAllHcpsByStatus(status, from, to, body) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByContactIds(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice/byCtcts" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcPartyGroupId(hcPartyId, groupId) {
    let _body = null
    const _url =
      this.host +
      "/invoice/byHcPartyGroupId/{hcPartyId}/{groupId}"
        .replace("{hcPartyId}", hcPartyId + "")
        .replace("{groupId}", groupId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcPartySentMediumTypeInvoiceTypeSentDate(
    hcPartyId,
    sentMediumType,
    invoiceType,
    sent,
    from,
    to
  ) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByHcpartySendingModeStatusDate(hcPartyId, sendingMode, status, from, to) {
    let _body = null
    const _url =
      this.host +
      "/invoice/byHcpartySendingModeStatusDate/{hcPartyId}".replace("{hcPartyId}", hcPartyId + "") +
      "?ts=" +
      new Date().getTime() +
      (sendingMode ? "&sendingMode=" + sendingMode : "") +
      (status ? "&status=" + status : "") +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByIds(invoiceIds) {
    let _body = null
    const _url =
      this.host +
      "/invoice/byIds/{invoiceIds}".replace("{invoiceIds}", invoiceIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByRecipientsIds(recipientIds) {
    let _body = null
    const _url =
      this.host +
      "/invoice/to/{recipientIds}".replace("{recipientIds}", recipientIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listByServiceIds(serviceIds) {
    let _body = null
    const _url =
      this.host +
      "/invoice/byServiceIds/{serviceIds}".replace("{serviceIds}", serviceIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToInsurances(userIds) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToInsurancesUnsent(userIds) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToPatients(hcPartyId) {
    let _body = null
    const _url =
      this.host +
      "/invoice/toPatients" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  listToPatientsUnsent(hcPartyId) {
    let _body = null
    const _url =
      this.host +
      "/invoice/toPatients/unsent" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  mergeTo(invoiceId, body) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  modifyInvoice(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  newDelegations(invoiceId, body) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  reassignInvoice(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice/reassign" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
  removeCodes(userId, serviceId, secretFKeys, body) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.InvoiceDto(it)))
      .catch(err => this.handleError(err))
  }
  setInvoicesDelegations(body) {
    let _body = null
    _body = body
    const _url = this.host + "/invoice/delegations" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => true)
      .catch(err => this.handleError(err))
  }
  validate(invoiceId, scheme, forcedValue) {
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
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.InvoiceDto(doc.body))
      .catch(err => this.handleError(err))
  }
}
exports.iccInvoiceApi = iccInvoiceApi
//# sourceMappingURL=iccInvoiceApi.js.map
