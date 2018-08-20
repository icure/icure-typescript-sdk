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

export class iccBedmgApi {
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

  confirmDmgMessages(token: string, body?: Array<models.DmgMessage>): Promise<boolean | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      "/be_dmg/message/delete/{token}".replace("{token}", token + "") +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("POST", _url, this.headers, _body)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  confirmDmgMessagesWithNames(token: string, names: string): Promise<boolean | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/message/{token}/{names}"
        .replace("{token}", token + "")
        .replace("{names}", names + "") +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("DELETE", _url, this.headers, _body)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  consultDmg(
    token: string,
    patientNiss: string,
    date?: number
  ): Promise<models.DmgConsultation | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/{token}/{patientNiss}"
        .replace("{token}", token + "")
        .replace("{patientNiss}", patientNiss + "") +
      "?ts=" +
      new Date().getTime() +
      (date ? "&date=" + date : "")

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgConsultation(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  consultDmgWithRegNumber(
    token: string,
    insurance: string,
    regNumber: string,
    gender: string,
    date?: number
  ): Promise<models.DmgConsultation | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/{token}/{insurance}/{regNumber}/{gender}"
        .replace("{token}", token + "")
        .replace("{insurance}", insurance + "")
        .replace("{regNumber}", regNumber + "")
        .replace("{gender}", gender + "") +
      "?ts=" +
      new Date().getTime() +
      (date ? "&date=" + date : "")

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgConsultation(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  fetchDmgMessages(token: string, names?: string): Promise<Array<models.DmgMessageResponse> | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/message/fetch/{token}".replace("{token}", token + "") +
      "?ts=" +
      new Date().getTime() +
      (names ? "&names=" + names : "")

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DmgMessageResponse(it)))
      .catch(err => this.handleError(err))
  }
  getDmgAcknowledge(): Promise<models.DmgAcknowledge | any> {
    let _body = null

    const _url =
      this.host + "/be_dmg/message/template/DmgAcknowledge" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgAcknowledge(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgClosure(): Promise<models.DmgClosure | any> {
    let _body = null

    const _url = this.host + "/be_dmg/message/template/DmgClosure" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgClosure(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgConsultation(): Promise<models.DmgConsultation | any> {
    let _body = null

    const _url =
      this.host + "/be_dmg/message/template/DmgConsultation" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgConsultation(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgExtension(): Promise<models.DmgExtension | any> {
    let _body = null

    const _url = this.host + "/be_dmg/message/template/DmgExtension" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgExtension(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgInscription(): Promise<models.DmgInscription | any> {
    let _body = null

    const _url =
      this.host + "/be_dmg/message/template/DmgInscription" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgInscription(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgNotification(): Promise<models.DmgNotification | any> {
    let _body = null

    const _url =
      this.host + "/be_dmg/message/template/DmgNotification" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgNotification(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgRegistration(): Promise<models.DmgRegistration | any> {
    let _body = null

    const _url =
      this.host + "/be_dmg/message/template/DmgRegistration" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgRegistration(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  getDmgsList(): Promise<models.DmgsList | any> {
    let _body = null

    const _url = this.host + "/be_dmg/message/template/DmgsList" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => new models.DmgsList(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  listDmgMessageTemplates(): Promise<Array<models.DmgMessage> | any> {
    let _body = null

    const _url = this.host + "/be_dmg/message/template/all" + "?ts=" + new Date().getTime()

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DmgMessage(it)))
      .catch(err => this.handleError(err))
  }
  listDmgMessages(token: string, names?: string): Promise<Array<models.DmgMessage> | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/message/{token}".replace("{token}", token + "") +
      "?ts=" +
      new Date().getTime() +
      (names ? "&names=" + names : "")

    return XHR.sendCommand("GET", _url, this.headers, _body)
      .then(doc => (doc.body as Array<JSON>).map(it => new models.DmgMessage(it)))
      .catch(err => this.handleError(err))
  }
  notifyDmg(
    token: string,
    patientNiss: string,
    code: string,
    date?: number,
    firstName?: string,
    lastName?: string,
    gender?: string
  ): Promise<models.DmgNotification | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/{token}/{patientNiss}/{code}"
        .replace("{token}", token + "")
        .replace("{patientNiss}", patientNiss + "")
        .replace("{code}", code + "") +
      "?ts=" +
      new Date().getTime() +
      (date ? "&date=" + date : "") +
      (firstName ? "&firstName=" + firstName : "") +
      (lastName ? "&lastName=" + lastName : "") +
      (gender ? "&gender=" + gender : "")

    return XHR.sendCommand("POST", _url, this.headers, _body)
      .then(doc => new models.DmgNotification(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  notifyDmgWithRegNumber(
    token: string,
    insurance: string,
    regNumber: string,
    code: string,
    date?: number,
    firstName?: string,
    lastName?: string,
    gender?: string
  ): Promise<models.DmgNotification | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/{token}/{insurance}/{regNumber}/{code}"
        .replace("{token}", token + "")
        .replace("{insurance}", insurance + "")
        .replace("{regNumber}", regNumber + "")
        .replace("{code}", code + "") +
      "?ts=" +
      new Date().getTime() +
      (date ? "&date=" + date : "") +
      (firstName ? "&firstName=" + firstName : "") +
      (lastName ? "&lastName=" + lastName : "") +
      (gender ? "&gender=" + gender : "")

    return XHR.sendCommand("POST", _url, this.headers, _body)
      .then(doc => new models.DmgNotification(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
  postDmgsListRequest(token: string, insurance: string, date?: number): Promise<boolean | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/message/request/{token}/{insurance}"
        .replace("{token}", token + "")
        .replace("{insurance}", insurance + "") +
      "?ts=" +
      new Date().getTime() +
      (date ? "&date=" + date : "")

    return XHR.sendCommand("POST", _url, this.headers, _body)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
  registerDoctor(
    token: string,
    oa: string,
    bic: string,
    iban: string
  ): Promise<models.DmgRegistration | any> {
    let _body = null

    const _url =
      this.host +
      "/be_dmg/register/{token}/{oa}/{bic}/{iban}"
        .replace("{token}", token + "")
        .replace("{oa}", oa + "")
        .replace("{bic}", bic + "")
        .replace("{iban}", iban + "") +
      "?ts=" +
      new Date().getTime()

    return XHR.sendCommand("POST", _url, this.headers, _body)
      .then(doc => new models.DmgRegistration(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
