import { ua2b64 } from '../model/ModelHelper'
import { NoAuthService } from '../../icc-x-api/auth/NoAuthService'
import { AuthService } from '../../icc-x-api/auth/AuthService'

export namespace XHR {
  export class Header {
    header: string
    data: string

    constructor(header: string, data: string) {
      this.header = header
      this.data = data
    }
  }

  export class Data {
    statusCode: number
    contentType: string
    body: JSON | Array<JSON> | any //stream bytes|json|array<json>

    constructor(status: number, contentType: string, body: JSON | Array<JSON> | any) {
      this.statusCode = status
      this.contentType = contentType
      this.body = body
    }
  }

  export class XHRError extends Error {
    statusCode: number
    errorCode: string
    headers: Headers
    message: string
    url: string

    constructor(url: string, message: string, status: number, errorCode: string, headers: Headers) {
      super(message)
      this.url = url
      this.statusCode = status
      this.message = message
      this.errorCode = errorCode
      this.headers = headers
    }
  }

  function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout = 10000,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      // Set timeout timer
      let timer = setTimeout(() => reject({ message: 'Request timed out', status: 'Request timed out' }), timeout)
      fetchImpl(url, init)
        .then((response) => {
          clearTimeout(timer)
          resolve(response)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  export async function sendCommand(
    method: string,
    url: string,
    headers: Array<Header> | null,
    data: string | any = '',
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch,
    contentTypeOverride?: 'application/json' | 'text/plain' | 'application/octet-stream',
    headerProvider: AuthService = new NoAuthService(),
    pastError = new Error('Something went wrong, try again later.')
  ): Promise<Data> {
    const authHeaders = await headerProvider.getAuthHeaders()
    if (!authHeaders) throw pastError
    const contentType = headers && headers.find((it) => (it.header ? it.header.toLowerCase() === 'content-type' : false))
    const clientTimeout = headers && headers.find((it) => (it.header ? it.header.toUpperCase() === 'X-CLIENT-SIDE-TIMEOUT' : false))
    const timeout = clientTimeout ? Number(clientTimeout.data) : 600000
    return fetchWithTimeout(
      url,
      Object.assign(
        {
          method: method,
          credentials: 'include' as RequestCredentials,
          headers: (headers ?? [])
            .concat(authHeaders)
            .filter(
              (h) =>
                (h.header?.toLowerCase() !== 'content-type' || h.data !== 'multipart/form-data') &&
                h.header?.toUpperCase() !== 'X-CLIENT-SIDE-TIMEOUT' &&
                h.header?.toLowerCase() !== 'force-authentication'
            )
            .reduce(
              (acc: { [key: string]: string }, h) => {
                acc[h.header] = h.data
                return acc
              },
              { 'X-Requested-With': 'XMLHttpRequest' }
            ),
        },
        method === 'POST' || method === 'PUT'
          ? {
              body:
                !contentType || contentType.data === 'application/json'
                  ? JSON.stringify(data, (k, v) => {
                      return v instanceof ArrayBuffer || v instanceof Uint8Array ? ua2b64(v) : v
                    })
                  : data,
            }
          : {}
      ),
      timeout,
      fetchImpl
    ).then(async function (response) {
      if (response.status === 401) {
        return sendCommand(
          method,
          url,
          headers,
          data,
          fetchImpl,
          contentTypeOverride,
          headerProvider,
          new XHRError(url, await response.text(), response.status, response.statusText, response.headers)
        )
      } else if (response.status >= 400) {
        const error: {
          error: string
          message: string
          status: number
        } = { error: response.statusText, message: await response.text(), status: response.status }
        console.warn(`XHR Error: ${error.status} - ${error.error}`, error.message)
        throw new XHRError(url, error.message, error.status, error.error, response.headers)
      } else {
        const ct = contentTypeOverride || response.headers.get('content-type') || 'text/plain'
        return (
          ct.startsWith('application/json')
            ? response.json()
            : ct.startsWith('application/xml') || ct.startsWith('text/')
            ? response.text()
            : response.arrayBuffer()
        ).then((d) => new Data(response.status, ct, d))
      }
    })
  }
}
