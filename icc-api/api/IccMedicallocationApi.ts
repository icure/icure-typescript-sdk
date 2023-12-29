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
import { MedicalLocation } from '../model/MedicalLocation'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { ListOfIds } from '../model/ListOfIds'

export class IccMedicallocationApi {
  host: string
  headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    authenticationProvider?: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = iccRestApiPath(host)
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = !!authenticationProvider ? authenticationProvider : new NoAuthenticationProvider()
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
   * @summary Creates a medical location
   * @param body
   */
  async createMedicalLocation(body?: MedicalLocation): Promise<MedicalLocation> {
    const _url = this.host + `/medicallocation` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MedicalLocation(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of medical locations.
   *
   * @param locationIds a ListOfIds containing the ids of the medical locations to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully deleted medical locations.
   */
  async deleteMedicalLocations(locationIds: ListOfIds): Promise<Array<DocIdentifier>> {
    return XHR.sendCommand(
      'POST',
      this.host + `/medicallocation/delete/batch` + '?ts=' + new Date().getTime(),
      this.headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json')),
      locationIds,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a medical location
   * @param locationId
   */
  async getMedicalLocation(locationId: string): Promise<MedicalLocation> {
    let _body = null

    const _url = this.host + `/medicallocation/${encodeURIComponent(String(locationId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MedicalLocation(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all medical locations
   */
  async getMedicalLocations(): Promise<Array<MedicalLocation>> {
    let _body = null

    const _url = this.host + `/medicallocation` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new MedicalLocation(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies a medical location
   * @param body
   */
  async modifyMedicalLocation(body?: MedicalLocation): Promise<MedicalLocation> {
    const _url = this.host + `/medicallocation` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new MedicalLocation(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
