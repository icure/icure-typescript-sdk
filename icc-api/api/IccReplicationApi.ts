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
import { ReplicateCommand } from '../model/ReplicateCommand'
import { ReplicatorDocument } from '../model/ReplicatorDocument'
import { ReplicatorResponse } from '../model/ReplicatorResponse'

export class IccReplicationApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(host: string, headers: any, fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
    this.host = host
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Create a document to start a continuous replication
   * @summary Create continuous replication document
   * @param body
   */
  createContinuousReplicationDoc(body?: ReplicateCommand): Promise<ReplicatorResponse> {
    let _body = null
    _body = body

    const _url = this.host + `/replication/continuous` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new ReplicatorResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Create a document to start a one time replication
   * @summary Create one time replication document
   * @param body
   */
  createOneTimeReplicationDoc(body?: ReplicateCommand): Promise<ReplicatorResponse> {
    let _body = null
    _body = body

    const _url = this.host + `/replication/onetime` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new ReplicatorResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * DocId is the id provided by a replicator document from replication/docs
   * @summary Delete replication document to stop it
   * @param docId
   */
  deleteReplicationDoc(docId: string): Promise<ReplicatorResponse> {
    let _body = null

    const _url = this.host + `/replication/stop/${encodeURIComponent(String(docId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new ReplicatorResponse(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get all replication infos and states
   * @summary Get replication documents
   */
  getReplicationDocs(): Promise<Array<ReplicatorDocument>> {
    let _body = null

    const _url = this.host + `/replication/docs` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ReplicatorDocument(it)))
      .catch((err) => this.handleError(err))
  }
}