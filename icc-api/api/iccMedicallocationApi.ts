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
import { DocIdentifier } from "../model/DocIdentifier"
import { MedicalLocationDto } from "../model/MedicalLocationDto"

export class iccMedicallocationApi {
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

  /**
   *
   * @summary Creates a medical location
   * @param body
   */
  createMedicalLocation(body?: MedicalLocationDto): Promise<MedicalLocationDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/medicalLocation" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new MedicalLocationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Deletes a medical location
   * @param locationIds
   */
  deleteMedicalLocation(locationIds: string): Promise<Array<DocIdentifier> | any> {
    let _body = null

    const _url =
      this.host +
      "/medicalLocation/${encodeURIComponent(String(locationIds))}".replace(
        "{locationIds}",
        locationIds + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new DocIdentifier(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets a medical location
   * @param locationId
   */
  getMedicalLocation(locationId: string): Promise<MedicalLocationDto | any> {
    let _body = null

    const _url =
      this.host +
      "/medicalLocation/${encodeURIComponent(String(locationId))}".replace(
        "{locationId}",
        locationId + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new MedicalLocationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets all medical locations
   */
  getMedicalLocations(): Promise<Array<MedicalLocationDto> | any> {
    let _body = null

    const _url = this.host + "/medicalLocation" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new MedicalLocationDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Modifies a medical location
   * @param body
   */
  modifyMedicalLocation(body?: MedicalLocationDto): Promise<MedicalLocationDto | any> {
    let _body = null
    _body = body

    const _url = this.host + "/medicalLocation" + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new MedicalLocationDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
