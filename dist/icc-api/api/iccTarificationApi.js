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
class iccTarificationApi {
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
  createTarification(body) {
    let _body = null
    _body = body
    const _url = this.host + "/tarification" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationDto(doc.body))
      .catch(err => this.handleError(err))
  }
  findPaginatedTarifications(region, type, tarification, version, startDocumentId, limit) {
    let _body = null
    const _url =
      this.host +
      "/tarification" +
      "?ts=" +
      new Date().getTime() +
      (region ? "&region=" + region : "") +
      (type ? "&type=" + type : "") +
      (tarification ? "&tarification=" + tarification : "") +
      (version ? "&version=" + version : "") +
      (startDocumentId ? "&startDocumentId=" + startDocumentId : "") +
      (limit ? "&limit=" + limit : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationPaginatedList(doc.body))
      .catch(err => this.handleError(err))
  }
  findPaginatedTarificationsByLabel(region, types, language, label, startDocumentId, limit) {
    let _body = null
    const _url =
      this.host +
      "/tarification/byLabel" +
      "?ts=" +
      new Date().getTime() +
      (region ? "&region=" + region : "") +
      (types ? "&types=" + types : "") +
      (language ? "&language=" + language : "") +
      (label ? "&label=" + label : "") +
      (startDocumentId ? "&startDocumentId=" + startDocumentId : "") +
      (limit ? "&limit=" + limit : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationPaginatedList(doc.body))
      .catch(err => this.handleError(err))
  }
  findTarifications(region, type, tarification, version) {
    let _body = null
    const _url =
      this.host +
      "/tarification/byRegionTypeTarification" +
      "?ts=" +
      new Date().getTime() +
      (region ? "&region=" + region : "") +
      (type ? "&type=" + type : "") +
      (tarification ? "&tarification=" + tarification : "") +
      (version ? "&version=" + version : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.TarificationDto(it)))
      .catch(err => this.handleError(err))
  }
  getTarification(tarificationId) {
    let _body = null
    const _url =
      this.host +
      "/tarification/{tarificationId}".replace("{tarificationId}", tarificationId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationDto(doc.body))
      .catch(err => this.handleError(err))
  }
  getTarificationWithParts(type, tarification, version) {
    let _body = null
    const _url =
      this.host +
      "/tarification/{type}/{tarification}/{version}"
        .replace("{type}", type + "")
        .replace("{tarification}", tarification + "")
        .replace("{version}", version + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationDto(doc.body))
      .catch(err => this.handleError(err))
  }
  getTarifications(body) {
    let _body = null
    _body = body
    const _url = this.host + "/tarification/byIds" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body.map(it => new models.TarificationDto(it)))
      .catch(err => this.handleError(err))
  }
  modifyTarification(body) {
    let _body = null
    _body = body
    const _url = this.host + "/tarification" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR_1.XHR.Header("Content-Type", "application/json"))
    return XHR_1.XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.TarificationDto(doc.body))
      .catch(err => this.handleError(err))
  }
}
exports.iccTarificationApi = iccTarificationApi
//# sourceMappingURL=iccTarificationApi.js.map
