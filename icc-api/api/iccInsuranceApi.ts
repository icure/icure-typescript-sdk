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
import { InsuranceDto } from "../model/InsuranceDto"
import { ListOfIdsDto } from "../model/ListOfIdsDto"

export class iccInsuranceApi {
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

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   *
   * @summary Creates an insurance
   * @param body
   */
  createInsurance(body?: InsuranceDto): Promise<InsuranceDto> {
    let _body = null
    _body = body

    const _url = this.host + `/insurance` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new InsuranceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an insurance
   * @param insuranceId
   */
  deleteInsurance(insuranceId: string): Promise<DocIdentifier> {
    let _body = null

    const _url =
      this.host +
      `/insurance/${encodeURIComponent(String(insuranceId))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then(doc => new DocIdentifier(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets an insurance
   * @param insuranceId
   */
  getInsurance(insuranceId: string): Promise<InsuranceDto> {
    let _body = null

    const _url =
      this.host +
      `/insurance/${encodeURIComponent(String(insuranceId))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new InsuranceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets insurances by id
   * @param body
   */
  getInsurances(body?: ListOfIdsDto): Promise<Array<InsuranceDto>> {
    let _body = null
    _body = body

    const _url = this.host + `/insurance/byIds` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new InsuranceDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets an insurance
   * @param insuranceCode
   */
  listInsurancesByCode(insuranceCode: string): Promise<Array<InsuranceDto>> {
    let _body = null

    const _url =
      this.host +
      `/insurance/byCode/${encodeURIComponent(String(insuranceCode))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new InsuranceDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Gets an insurance
   * @param insuranceName
   */
  listInsurancesByName(insuranceName: string): Promise<Array<InsuranceDto>> {
    let _body = null

    const _url =
      this.host +
      `/insurance/byName/${encodeURIComponent(String(insuranceName))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new InsuranceDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an insurance
   * @param body
   */
  modifyInsurance(body?: InsuranceDto): Promise<InsuranceDto> {
    let _body = null
    _body = body

    const _url = this.host + `/insurance` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new InsuranceDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
