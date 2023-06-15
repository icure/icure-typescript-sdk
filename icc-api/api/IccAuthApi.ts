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
import { AuthenticationResponse } from '../model/AuthenticationResponse'
import { LoginCredentials } from '../model/LoginCredentials'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export enum OAuthThirdParty {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  APPLE = 'apple',
  LINKEDIN = 'linkedin',
  GITHUB = 'github',
}

export class IccAuthApi {
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

  /**
   * Check login using groupId/userId and password
   * @summary check
   * @param body
   */
  check(body?: LoginCredentials): Promise<AuthenticationResponse> {
    let _body = null
    _body = body

    const _url = this.host + `/auth/check` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type' && h.header?.toLowerCase() !== 'authorization')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Login using username and password
   * @summary login
   * @param body
   */
  login(body?: LoginCredentials): Promise<AuthenticationResponse> {
    let _body = null
    _body = body

    const _url = this.host + `/auth/login` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type' && h.header?.toLowerCase() !== 'authorization')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined)
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Login using third party OAuth provider token
   * @summary login
   * @param thirdParty The third party OAuth service used to authenticate the user
   * @param token The token returned by the third party OAuth service
   */
  loginWithThirdPartyToken(thirdParty: string, token: string): Promise<AuthenticationResponse> {
    let _body = null
    _body = token

    const _url = this.host + `/auth/login/${thirdParty}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type' && h.header?.toLowerCase() !== 'authorization')
      .concat(new XHR.Header('Content-Type', 'application/json'))
      .concat(new XHR.Header('token', token))
    return XHR.sendCommand('POST', _url, headers, null, this.fetchImpl, undefined)
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Logout
   * @summary logout
   */
  logout(): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/logout` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand(
      'GET',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Logout
   * @summary logout
   */
  logoutPost(): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/logout` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand(
      'POST',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get token for subsequent operation
   * @summary token
   * @param method
   * @param path
   */
  token(method: string, path: string): Promise<string> {
    let _body = null

    const _url = this.host + `/auth/token/${encodeURIComponent(String(method))}/${encodeURIComponent(String(path))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)) as string)
      .catch((err) => this.handleError(err))
  }

  /**
   * Gets a new authentication and refresh JWT for a different group
   */
  switchGroup(refreshJWT: string, groupId: string): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/switch/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()
    let headers = [...this.headers, new XHR.Header('Refresh-Token', refreshJWT)]
    return XHR.sendCommand(
      'POST',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Gets a new authentication JWT using the refresh JWT
   * @summary refresh
   */
  refreshAuthenticationJWT(refreshJWT: string): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/refresh` + '?ts=' + new Date().getTime()
    let headers = [...this.headers, new XHR.Header('Refresh-Token', refreshJWT)]
    return XHR.sendCommand(
      'POST',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Switch groups using the refresh JWT
   * @summary switch groups
   */
  switchGroupUsingRefreshJWT(groupId: string): Promise<AuthenticationResponse> {
    return this.authenticationProvider.getIcureTokens().then((tokens) => {
      let _body = null
      const _url = this.host + `/auth/switch/${encodeURIComponent(String(groupId))}` + '?ts=' + new Date().getTime()

      const refreshToken = tokens?.refreshToken
      if (!refreshToken) {
        throw new Error('No refresh token found')
      }
      let headers = [...this.headers, new XHR.Header('Refresh-Token', refreshToken)]
      return XHR.sendCommand(
        'POST',
        _url,
        headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
        _body,
        this.fetchImpl
      )
        .then((doc) => new AuthenticationResponse(doc.body as JSON))
        .catch((err) => this.handleError(err))
    })
  }

  /**
   * Invalidates a refresh JWT
   * @summary invalidate
   */
  invalidateRefreshJWT(refreshJWT: string): Promise<AuthenticationResponse> {
    let _body = null

    const _url = this.host + `/auth/invalidate` + '?ts=' + new Date().getTime()
    let headers = [...this.headers, new XHR.Header('Refresh-Token', refreshJWT)]
    return XHR.sendCommand(
      'POST',
      _url,
      headers.filter((h) => h.header?.toLowerCase() !== 'authorization'),
      _body,
      this.fetchImpl
    )
      .then((doc) => new AuthenticationResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
