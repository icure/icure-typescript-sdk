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
import { IndexingInfoDto } from "../model/IndexingInfoDto"
import { ReplicationInfoDto } from "../model/ReplicationInfoDto"
import { Unit } from "../model/Unit"
import { UserStubDto } from "../model/UserStubDto"

export class iccIcureApi {
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
   * @summary Get index info
   */
  getIndexingInfo(): Promise<IndexingInfoDto | any> {
    let _body = null

    const _url = this.host + "/icure/i" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new IndexingInfoDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get process info
   */
  getProcessInfo(): Promise<string | any> {
    let _body = null

    const _url = this.host + "/icure/p" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get property types
   * @param type
   */
  getPropertyTypes(type: string): Promise<Array<string> | any> {
    let _body = null

    const _url =
      this.host +
      "/icure/propertytypes/${encodeURIComponent(String(type))}".replace("{type}", type + "") +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => JSON.parse(JSON.stringify(it))))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get index info
   */
  getReplicationInfo(): Promise<ReplicationInfoDto | any> {
    let _body = null

    const _url = this.host + "/icure/r" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => new ReplicationInfoDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get users stubs
   */
  getUsers(): Promise<Array<UserStubDto> | any> {
    let _body = null

    const _url = this.host + "/icure/u" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new UserStubDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Get version
   */
  getVersion(): Promise<string | any> {
    let _body = null

    const _url = this.host + "/icure/v" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Check if a patient exists
   */
  isPatientReady(): Promise<string | any> {
    let _body = null

    const _url = this.host + "/icure/pok" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Check if a user exists
   */
  isReady(): Promise<string | any> {
    let _body = null

    const _url = this.host + "/icure/ok" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Resolve contacts conflicts
   */
  resolveContactsConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/contact" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary resolve documents conflicts
   * @param ids
   */
  resolveDocumentsConflicts(ids?: string): Promise<Unit | any> {
    let _body = null

    const _url =
      this.host +
      "/icure/conflicts/document" +
      "?ts=" +
      new Date().getTime() +
      (ids ? "&ids=" + ids : "")
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary resolve forms conflicts
   */
  resolveFormsConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/form" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary resolve health elements conflicts
   */
  resolveHealthElementsConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/healthelement" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary resolve invoices conflicts
   */
  resolveInvoicesConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/invoice" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary resolve messages conflicts
   */
  resolveMessagesConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/message" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Resolve patients conflicts
   */
  resolvePatientsConflicts(): Promise<Unit | any> {
    let _body = null

    const _url = this.host + "/icure/conflicts/patient" + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new Unit(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   *
   * @summary Force update design doc
   * @param entityName
   */
  updateDesignDoc(entityName: string): Promise<boolean | any> {
    let _body = null

    const _url =
      this.host +
      "/icure/dd/${encodeURIComponent(String(entityName))}".replace(
        "{entityName}",
        entityName + ""
      ) +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }
}
