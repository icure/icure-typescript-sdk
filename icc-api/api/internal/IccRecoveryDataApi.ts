import { XHR } from '../XHR'
import { RecoveryData } from '../../model/internal/RecoveryData'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../../icc-x-api'
import { iccRestApiPath } from '../IccRestApiPath'
import { DocIdentifier } from '../../model/DocIdentifier'
import { Content } from '../../model/Content'

export class IccRecoveryDataApi {
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

  async createRecoveryData(body?: RecoveryData): Promise<RecoveryData> {
    const _url = this.host + `/recoverydata` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new RecoveryData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  async getRecoveryData(recoveryDataId: string): Promise<RecoveryData> {
    const _url = this.host + `/recoverydata/${encodeURIComponent(String(recoveryDataId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new RecoveryData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  async deleteRecoveryData(recoveryDataId: string): Promise<DocIdentifier> {
    const _url = this.host + `/recoverydata/${encodeURIComponent(String(recoveryDataId))}` + '?ts=' + new Date().getTime()
    return XHR.sendCommand('DELETE', _url, this.headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocIdentifier(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  async deleteAllRecoveryDataForRecipient(recipientId: string): Promise<Content> {
    const _url = this.host + `/recoverydata/forRecipient/${encodeURIComponent(String(recipientId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('DELETE', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  async deleteAllRecoveryDataOfTypeForRecipient(type: string, recipientId: string): Promise<Content> {
    const _url =
      this.host +
      `/recoverydata/forRecipient/${encodeURIComponent(String(recipientId))}/ofType/${encodeURIComponent(String(type))}` +
      '?ts=' +
      new Date().getTime()
    return XHR.sendCommand('DELETE', _url, this.headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
