import { XHR } from './XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { ExchangeDataMap } from '../model/ExchangeDataMap'
import { ExchangeDataMapCreationBatch } from '../model/ExchangeDataMapCreationBatch'
import { ListOfIds } from '../model/ListOfIds'

export class IccExchangeDataMapApi {
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

  getExchangeDataMapById(exchangeDataMapId: string): Promise<ExchangeDataMap> {
    const _url = this.host + `/exchangedatamap/${encodeURIComponent(String(exchangeDataMapId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeDataMap(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  getExchangeDataMapByBatch(ids: string[]): Promise<ExchangeDataMap[]> {
    const _url = this.host + `/exchangedatamap/batch` + '?ts=' + new Date().getTime()
    const body = new ListOfIds({ ids })
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body as ExchangeDataMap[])
      .catch((err) => this.handleError(err))
  }

  createExchangeDataMap(body: ExchangeDataMap): Promise<ExchangeDataMap> {
    const _url = this.host + `/exchangedatamap` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeDataMap(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  createExchangeDataMapBatch(body: ExchangeDataMapCreationBatch): Promise<string> {
    const _url = this.host + `/exchangedatamap/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body as string)
      .catch((err) => this.handleError(err))
  }

  modifyExchangeDataMapForKey(accessControlKey: string, body: ExchangeDataMap): Promise<ExchangeDataMap> {
    const _url = this.host + `/exchangedatamap/forKey/${encodeURIComponent(String(accessControlKey))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new ExchangeDataMap(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}