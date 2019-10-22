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

export class iccFormApi {
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

  convertLegacyFormTemplates(body?: Array<string>): Promise<Array<models.FormLayout> | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form/template/legacy" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormLayout(it)))
      .catch(err => this.handleError(err))
  }
  createForm(body?: models.FormDto): Promise<models.FormDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  createFormTemplate(body?: models.FormTemplateDto): Promise<models.FormTemplateDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form/template" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  deleteFormTemplate(formTemplateId: string): Promise<boolean | any> {
    let _body = null

    const _url =
      this.host +
      "/form/template/{formTemplateId}".replace("{formTemplateId}", formTemplateId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  deleteForms(formIds: string): Promise<Array<string> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/{formIds}".replace("{formIds}", formIds + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }
  findByHCPartyPatientSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string,
    healthElementId?: string,
    planOfActionId?: string,
    formTemplateId?: string
  ): Promise<Array<models.FormDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/byHcPartySecretForeignKeys" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "") +
      (healthElementId ? "&healthElementId=" + healthElementId : "") +
      (planOfActionId ? "&planOfActionId=" + planOfActionId : "") +
      (formTemplateId ? "&formTemplateId=" + formTemplateId : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormDto(it)))
      .catch(err => this.handleError(err))
  }
  findDelegationsStubsByHCPartyPatientSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.IcureStubDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/byHcPartySecretForeignKeys/delegations" +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + hcPartyId : "") +
      (secretFKeys ? "&secretFKeys=" + secretFKeys : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.IcureStubDto(it)))
      .catch(err => this.handleError(err))
  }
  findFormTemplates(loadLayout?: boolean): Promise<Array<models.FormTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/template" +
      "?ts=" +
      new Date().getTime() +
      (loadLayout ? "&loadLayout=" + loadLayout : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  findFormTemplatesBySpeciality(
    specialityCode: string,
    loadLayout?: boolean
  ): Promise<Array<models.FormTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/template/bySpecialty/{specialityCode}".replace(
        "{specialityCode}",
        specialityCode + ""
      ) +
      "?ts=" +
      new Date().getTime() +
      (loadLayout ? "&loadLayout=" + loadLayout : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  getChildren(formId: string, hcPartyId: string): Promise<Array<models.FormDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/childrenOf/{formId}/{hcPartyId}"
        .replace("{formId}", formId + "")
        .replace("{hcPartyId}", hcPartyId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormDto(it)))
      .catch(err => this.handleError(err))
  }
  getForm(formId: string): Promise<models.FormDto | any> {
    let _body = null

    const _url =
      this.host + "/form/{formId}".replace("{formId}", formId + "") + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getFormTemplate(formTemplateId: string): Promise<models.FormTemplateDto | any> {
    let _body = null

    const _url =
      this.host +
      "/form/template/{formTemplateId}".replace("{formTemplateId}", formTemplateId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getFormTemplatesByGuid(
    formTemplateGuid: string,
    specialityCode: string
  ): Promise<Array<models.FormTemplateDto> | any> {
    let _body = null

    const _url =
      this.host +
      "/form/template/{specialityCode}/guid/{formTemplateGuid}"
        .replace("{formTemplateGuid}", formTemplateGuid + "")
        .replace("{specialityCode}", specialityCode + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormTemplateDto(it)))
      .catch(err => this.handleError(err))
  }
  getForms(body?: models.ListOfIdsDto): Promise<Array<models.FormDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form/byIds" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormDto(it)))
      .catch(err => this.handleError(err))
  }
  modifyForm(body?: models.FormDto): Promise<models.FormDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  modifyForms(body?: Array<models.FormDto>): Promise<Array<models.FormDto> | any> {
    let _body = null
    _body = body

    const _url = this.host + "/form/batch" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.FormDto(it)))
      .catch(err => this.handleError(err))
  }
  newDelegations(
    formId: string,
    body?: Array<models.DelegationDto>
  ): Promise<models.FormDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/form/delegate/{formId}".replace("{formId}", formId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  setAttachmentMulti(formTemplateId: string, attachment?: Array<string>): Promise<string | any> {
    let _body = null
    attachment &&
      (_body = _body || new FormData()).append(
        "attachment",
        new Blob(attachment, { type: "application/octet-stream" })
      )
    const _url =
      this.host +
      "/form/template/{formTemplateId}/attachment/multipart".replace(
        "{formTemplateId}",
        formTemplateId + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "multipart/form-data"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  setHealthElementsDelegations(body?: Array<models.IcureStubDto>): Promise<any | Boolean> {
    let _body = null
    _body = body

    const _url = this.host + "/form/delegations" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => true)
      .catch(err => this.handleError(err))
  }
  updateFormTemplate(
    formTemplateId: string,
    body?: models.FormTemplateDto
  ): Promise<models.FormTemplateDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/form/template/{formTemplateId}".replace("{formTemplateId}", formTemplateId + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new models.FormTemplateDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
