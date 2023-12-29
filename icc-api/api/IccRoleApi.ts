import { XHR } from './XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { Role } from '../model/Role'
import { iccRestApiPath } from './IccRestApiPath'

export class IccRoleApi {
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
   *
   * @summary Gets all roles
   */
  async getRoles(): Promise<Array<Role>> {
    const _url = this.host + `/role` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Role(it)))
      .catch((err) => this.handleError(err))
  }
}
