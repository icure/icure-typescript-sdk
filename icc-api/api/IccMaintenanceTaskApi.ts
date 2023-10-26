/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from './XHR'
import { DocIdentifier } from '../model/DocIdentifier'
import { FilterChainMaintenanceTask } from '../model/FilterChainMaintenanceTask'
import { MaintenanceTask } from '../model/MaintenanceTask'
import { PaginatedListMaintenanceTask } from '../model/PaginatedListMaintenanceTask'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { ListOfIds } from '../model/ListOfIds'

export class IccMaintenanceTaskApi {
  host: string
  _headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  get headers(): Promise<Array<XHR.Header>> {
    return Promise.resolve(this._headers)
  }

  constructor(
    host: string,
    headers: any,
    authenticationProvider?: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = iccRestApiPath(host)
    this._headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = !!authenticationProvider ? authenticationProvider : new NoAuthenticationProvider()
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this._headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   *
   * @summary Creates a maintenanceTask
   * @param body
   */
  async createMaintenanceTask(body?: MaintenanceTask): Promise<MaintenanceTask> {
    const _url = this.host + `/maintenancetask` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MaintenanceTask(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of maintenanceTasks.
   *
   * @param maintenanceTaskIds a ListOfIds containing the ids of the maintenanceTasks to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully deleted maintenanceTasks.
   */
  async deleteMaintenanceTasks(maintenanceTaskIds: ListOfIds): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/maintenancetask/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      maintenanceTaskIds,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single maintenanceTask by id.
   *
   * @param maintenanceTaskId the id of the maintenanceTask to delete.
   * @return a Promise that will resolve in the DocIdentifier of the deleted maintenanceTask.
   */
  async deleteMaintenanceTask(maintenanceTaskId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/maintenancetask/${encodeURIComponent(maintenanceTaskId)}` + '?ts=' + new Date().getTime(),
      await this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc.body))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of maintenanceTasks along with next start keys and Document ID. If the nextStartKey is Null it means that this is the last page.
   * @summary Filter maintenanceTasks for the current user (HcParty)
   * @param body
   * @param startDocumentId A maintenanceTask document ID
   * @param limit Number of rows
   */
  async filterMaintenanceTasksBy(startDocumentId?: string, limit?: number, body?: FilterChainMaintenanceTask): Promise<PaginatedListMaintenanceTask> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/maintenancetask/filter` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListMaintenanceTask(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a maintenanceTask
   * @param maintenanceTaskId
   */
  async getMaintenanceTask(maintenanceTaskId: string): Promise<MaintenanceTask> {
    let _body = null

    const _url = this.host + `/maintenancetask/${encodeURIComponent(String(maintenanceTaskId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MaintenanceTask(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Updates a maintenanceTask
   * @param body
   */
  async modifyMaintenanceTask(body?: MaintenanceTask): Promise<MaintenanceTask> {
    let _body = null
    _body = body

    const _url = this.host + `/maintenancetask` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MaintenanceTask(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareMaintenanceTask(request: {
    [entityId: string]: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
  }): Promise<EntityBulkShareResult<MaintenanceTask>[]> {
    const _url = this.host + '/maintenancetask/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<MaintenanceTask>(x, MaintenanceTask)))
      .catch((err) => this.handleError(err))
  }
}
