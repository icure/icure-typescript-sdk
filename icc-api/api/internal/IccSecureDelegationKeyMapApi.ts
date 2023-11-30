import { EntityShareOrMetadataUpdateRequest } from '../../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../../model/requests/EntityBulkShareResult'
import { XHR } from '../XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../../icc-x-api'
import { iccRestApiPath } from '../IccRestApiPath'
import { SecureDelegationKeyMap } from '../../model/internal/SecureDelegationKeyMap'
import { ListOfIds } from '../../model/ListOfIds'
import { BulkShareOrUpdateMetadataParams } from '../../model/requests/BulkShareOrUpdateMetadataParams'

/**
 * @internal this class is for internal use only and may be changed without notice.
 */
export class IccSecureDelegationKeyMapApi {
  host: string
  _headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

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

  get headers(): Promise<Array<XHR.Header>> {
    return Promise.resolve(this._headers)
  }

  setHeaders(h: Array<XHR.Header>) {
    this._headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  async getByDelegationKeys(delegationKeys: ListOfIds, proofOfAccessHeaders: XHR.Header[]): Promise<SecureDelegationKeyMap[]> {
    let _body = delegationKeys

    const _url = this.host + `/securedelegationkeymap/bydelegationkeys` + '?ts=' + new Date().getTime()
    let headers = [...(await this.headers), ...proofOfAccessHeaders]
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new SecureDelegationKeyMap(it)))
      .catch((err) => this.handleError(err))
  }

  async create(delegationKeyMap: SecureDelegationKeyMap, proofOfAccessHeader: XHR.Header): Promise<SecureDelegationKeyMap> {
    let _body = delegationKeyMap

    const _url = this.host + `/securedelegationkeymap` + '?ts=' + new Date().getTime()
    let headers = [...(await this.headers), proofOfAccessHeader]
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new SecureDelegationKeyMap(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  async bulkShareSecureDelegationKeyMap(
    request: BulkShareOrUpdateMetadataParams,
    proofOfAccessHeaders: XHR.Header[]
  ): Promise<EntityBulkShareResult<SecureDelegationKeyMap>[]> {
    const _url = this.host + '/securedelegationkeymap/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = [...(await this.headers), ...proofOfAccessHeaders]
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<SecureDelegationKeyMap>(x, SecureDelegationKeyMap)))
      .catch((err) => this.handleError(err))
  }
}
