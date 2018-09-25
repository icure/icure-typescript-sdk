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

export class iccBeetarifApi {
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

  consultTarif(
    token: string,
    patientNiss: string,
    codes: string,
    justification?: string,
    date?: number,
    nihiiDmg?: string
  ): Promise<models.TarificationConsultationResultDto | any> {
    let _body = null

    const _url =
      this.host +
      "/be_etarif/{token}/{patientNiss}/{codes}"
        .replace("{token}", token + "")
        .replace("{patientNiss}", patientNiss + "")
        .replace("{codes}", codes + "") +
      "?ts=" +
      new Date().getTime() +
      (justification ? "&justification=" + justification : "") +
      (date ? "&date=" + date : "") +
      (nihiiDmg ? "&nihiiDmg=" + nihiiDmg : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("GET", _url, headers, _body)
      .then(doc => new models.TarificationConsultationResultDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
