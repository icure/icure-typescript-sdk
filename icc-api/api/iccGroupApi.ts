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
import { DatabaseInitialisationDto } from "../model/DatabaseInitialisationDto"
import { GroupDto } from "../model/GroupDto"

export class iccGroupApi {
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
   * Create a new group and associated dbs.  The created group will be manageable by the users that belong to the same group as the one that called createGroup. Several tasks can be executed during the group creation like DB replications towards the created DBs, users creation and healthcare parties creation
   * @summary Create a group
   * @param body initialisationData is an object that contains the initial replications (target must be an internalTarget of value base, healthdata or patient) and the users and healthcare parties to be created
   * @param id The id of the group, also used for subsequent authentication against the db (can only contain digits, letters, - and _)
   * @param name The name of the group
   * @param password The password of the group (can only contain digits, letters, - and _)
   * @param server The server on which the group dbs will be created
   * @param q The number of shards for patient and healthdata dbs : 3-8 is a recommended range of value
   * @param n The number of replications for dbs : 3 is a recommended value
   */
  createGroup(
    id: string,
    name: string,
    password: string,
    server?: string,
    q?: number,
    n?: number,
    body?: DatabaseInitialisationDto
  ): Promise<GroupDto | any> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}` +
      "?ts=" +
      new Date().getTime() +
      (name ? "&name=" + encodeURIComponent(String(name)) : "") +
      (server ? "&server=" + encodeURIComponent(String(server)) : "") +
      (q ? "&q=" + encodeURIComponent(String(q)) : "") +
      (n ? "&n=" + encodeURIComponent(String(n)) : "")
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    password && (headers = headers.concat(new XHR.Header("password", password)))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then(doc => new GroupDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }

  /**
   * Create a new gorup with associated dbs
   * @summary List groups
   */
  listGroups(): Promise<Array<GroupDto> | any> {
    let _body = null

    const _url = this.host + `/group` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => (doc.body as Array<JSON>).map(it => new GroupDto(it)))
      .catch(err => this.handleError(err))
  }

  /**
   * Create a new gorup with associated dbs
   * @summary List groups
   * @param id The id of the group
   * @param password The new password for the group (can only contain digits, letters, - and _)
   */
  setGroupPassword(id: string, password: string): Promise<GroupDto | any> {
    let _body = null

    const _url =
      this.host +
      `/group/${encodeURIComponent(String(id))}/password` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    password && (headers = headers.concat(new XHR.Header("password", password)))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => new GroupDto(doc.body as JSON))
      .catch(err => this.handleError(err))
  }
}
