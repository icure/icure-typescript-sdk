import { XHR } from './XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { AccessLog } from '../model/AccessLog'
import { ExchangeData } from '../model/ExchangeData'
import { PaginatedListExchangeData } from '../model/PaginatedListExchangeData'

export class IccExchangeDataApi {
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
    this.host = host
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

  createExchangeData(body?: ExchangeData): Promise<ExchangeData> {
    const _url = this.host + `/exchangedata` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  modifyExchangeData(body?: ExchangeData): Promise<ExchangeData> {
    const _url = this.host + `/exchangedata` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  getExchangeDataById(exchangeDataId: string): Promise<ExchangeData> {
    const _url = this.host + `/exchangedata/${encodeURIComponent(String(exchangeDataId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  getExchangeDataByDelegatorDelegate(delegatorId: string, delegateId: string): Promise<ExchangeData[]> {
    const _url =
      this.host +
      `/exchangedata/byDelegatorDelegate/${encodeURIComponent(String(delegatorId))}/${encodeURIComponent(String(delegateId))}` +
      '?ts=' +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ExchangeData(it)))
      .catch((err) => this.handleError(err))
  }

  getExchangeDataByParticipant(dataOwnerId: string, startDocumentId?: string, limit?: number): Promise<PaginatedListExchangeData> {
    const _url =
      this.host +
      `/exchangedata/byParticipant/${encodeURIComponent(String(dataOwnerId))}` +
      '?ts=' +
      new Date().getTime() +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new PaginatedListExchangeData(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
