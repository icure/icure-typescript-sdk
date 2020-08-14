/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from "./XHR"

export class iccPubsubApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map(k => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Offer auth data on previously agreed on secret bucket, data should be encrypted
   * @summary Offer auth data on secret bucket
   * @param body
   * @param bucket
   */
  offerAuth(bucket: string, body?: Array<string>): Promise<{ [key: string]: boolean }> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/pubsub/auth/${encodeURIComponent(String(bucket))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   * Publish value with key
   * @summary publish data
   * @param body
   * @param key
   */
  pub(key: string, body?: Array<string>): Promise<{ [key: string]: boolean }> {
    let _body = null
    _body = body

    const _url =
      this.host + `/pubsub/pub/${encodeURIComponent(String(key))}` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter(h => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then(doc => JSON.parse(JSON.stringify(doc.body)))
      .catch(err => this.handleError(err))
  }

  /**
   * Recover auth data from bucket, data should be encrypted
   * @summary Recover auth data from secret bucket
   * @param bucket
   */
  recoverAuth(bucket: string): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host +
      `/pubsub/auth/recover/${encodeURIComponent(String(bucket))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body)
      .catch(err => this.handleError(err))
  }

  /**
   * Try to get published data
   * @summary subscribe to data
   * @param key
   */
  sub(key: string): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host + `/pubsub/sub/${encodeURIComponent(String(key))}` + "?ts=" + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then(doc => doc.body)
      .catch(err => this.handleError(err))
  }
}
