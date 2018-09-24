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

export class iccDoctemplateApi {
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

  createDocumentTemplate(
    body?: models.DocumentTemplateDto
  ): Promise<models.DocumentTemplateDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/doctemplate" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body)
      .then(doc => new models.DocumentTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  findAllDocumentTemplates(): Promise<Array<models.DocumentTemplateDto> | any> {
    let _body = null

    const _url = this.host + "/doctemplate/find/all" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocumentTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  findDocumentTemplates(): Promise<Array<models.DocumentTemplateDto> | any> {
    let _body = null

    const _url = this.host + "/doctemplate" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocumentTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  findDocumentTemplatesBySpeciality(
    specialityCode: string
  ): Promise<Array<models.DocumentTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/doctemplate/bySpecialty/{specialityCode}".replace("{specialityCode}", specialityCode + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocumentTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  findDocumentTemplatesByDocumentType(
    documentTypeCode: string
  ): Promise<Array<models.DocumentTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/doctemplate/byDocumentType/{documentTypeCode}".replace(
        "{documentTypeCode}",
        documentTypeCode + ""
      ) +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocumentTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  findDocumentTemplatesByDocumentTypeForCurrentUser(
    documentTypeCode: string
  ): Promise<Array<models.DocumentTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/doctemplate/byDocumentTypeForCurrentUser/{documentTypeCode}".replace(
        "{documentTypeCode}",
        documentTypeCode + ""
      ) +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DocumentTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  getAttachment(documentTemplateId: string, attachmentId: string): Promise<any | Boolean> {
    let _body = null

    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}/attachment/{attachmentId}"
        .replace("{documentTemplateId}", documentTemplateId + "")
        .replace("{attachmentId}", attachmentId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => (doc.contentType.startsWith("application/octet-stream") ? doc.body : true))
      .catch(err => this.handleError(err))
  }
  getDocumentTemplate(documentTemplateId: string): Promise<models.DocumentTemplateDto | any> {
    let _body = null

    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}".replace("{documentTemplateId}", documentTemplateId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => new models.DocumentTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  setAttachment(
    documentTemplateId: string,
    body?: Array<string>
  ): Promise<models.DocumentTemplateDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}/attachment".replace(
        "{documentTemplateId}",
        documentTemplateId + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body)
      .then(doc => new models.DocumentTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  updateDocumentTemplate(
    documentTemplateId: string,
    body?: models.DocumentTemplateDto
  ): Promise<models.DocumentTemplateDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/doctemplate/{documentTemplateId}".replace("{documentTemplateId}", documentTemplateId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body)
      .then(doc => new models.DocumentTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
