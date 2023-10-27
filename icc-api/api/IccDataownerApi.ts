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
import { DataOwnerWithType } from '../model/DataOwnerWithType'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api'
import { CryptoActorStubWithType } from '../model/CryptoActorStub'
import { iccRestApiPath } from './IccRestApiPath'

export class IccDataownerApi {
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

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * General information about the current data owner. Note that this does not decrpyt patient data owners.
   * @summary Get the data owner corresponding to the current user
   */
  async getCurrentDataOwner(): Promise<DataOwnerWithType> {
    let _body = null

    const _url = this.host + `/dataowner/current` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => DataOwnerWithType.fromJson(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Full data owner information
   * @summary Get a data owner by his ID
   * @param dataOwnerId
   */
  async getDataOwner(dataOwnerId: string): Promise<DataOwnerWithType> {
    let _body = null

    const _url = this.host + `/dataowner/${encodeURIComponent(String(dataOwnerId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => DataOwnerWithType.fromJson(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * General information about the keys of a data owner
   * @summary Get a data owner by his ID
   * @param dataOwnerId
   */
  async getCryptoActorStub(dataOwnerId: string): Promise<CryptoActorStubWithType> {
    let _body = null

    const _url = this.host + `/dataowner/stub/${encodeURIComponent(String(dataOwnerId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new CryptoActorStubWithType(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Updates the keys of a data owner
   */
  async modifyCryptoActorStub(stub: CryptoActorStubWithType): Promise<CryptoActorStubWithType> {
    let _body = stub

    const _url = this.host + `/dataowner/stub` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new CryptoActorStubWithType(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
