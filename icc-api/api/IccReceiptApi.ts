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
import { DocIdentifier } from '../model/DocIdentifier'
import { Receipt } from '../model/Receipt'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { ListOfIds } from '../model/ListOfIds'

export class IccReceiptApi {
  host: string
  _headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  get headers(): Promise<Array<XHR.Header>> {
    return Promise.resolve(this._headers)
  }

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

  setHeaders(h: Array<XHR.Header>) {
    this._headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   *
   * @summary Creates a receipt
   * @param body
   */
  async createReceipt(body?: Receipt): Promise<Receipt> {
    let _body = null
    _body = body

    const _url = this.host + `/receipt` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Receipt(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a batch of receipts.
   *
   * @param receiptIds an array containing the ids of the receipts to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers of the successfully deleted receipts.
   */
  async deleteReceipts(receiptIds: string[]): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/receipt/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      new ListOfIds({ ids: receiptIds }),
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single receipt by id.
   *
   * @param receiptId the id of the receipt to delete.
   * @return a Promise that will resolve in the DocIdentifier of the deleted receipt.
   */
  async deleteReceipt(receiptId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/receipt/${encodeURIComponent(receiptId)}` + '?ts=' + new Date().getTime(),
      await this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a receipt
   * @param receiptId
   */
  async getReceipt(receiptId: string): Promise<Receipt> {
    let _body = null

    const _url = this.host + `/receipt/${encodeURIComponent(String(receiptId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Receipt(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get an attachment
   * @param receiptId
   * @param attachmentId
   * @param enckeys
   */
  async getReceiptAttachment(receiptId: string, attachmentId: string, enckeys?: null): Promise<ArrayBuffer> {
    if (enckeys) {
      throw new Error('Server-side encryption is not supported anymore.')
    }
    let _body = null

    const _url =
      this.host +
      `/receipt/${encodeURIComponent(String(receiptId))}/attachment/${encodeURIComponent(String(attachmentId))}` +
      '?ts=' +
      new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a receipt
   * @param ref
   */
  async listByReference(ref: string): Promise<Array<Receipt>> {
    let _body = null

    const _url = this.host + `/receipt/byref/${encodeURIComponent(String(ref))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Receipt(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Updates a receipt
   * @param body
   */
  async modifyReceipt(body?: Receipt): Promise<Receipt> {
    let _body = null
    _body = body

    const _url = this.host + `/receipt` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Receipt(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @deprecated use setReceiptAttachmentForBlobType instead
   */
  async setReceiptAttachment(receiptId: string, receiptRev: string, blobType: string, enckeys?: null, body?: ArrayBuffer): Promise<Receipt> {
    if (enckeys) {
      throw new Error('Server-side encryption is not supported anymore.')
    }
    if (!body) {
      throw new Error('Attachment content is requred')
    }
    return this.setReceiptAttachmentForBlobType(receiptId, receiptRev, blobType, body)
  }

  /**
   * @summary Creates a receipt's attachment
   * @param receiptId id of a receipt
   * @param receiptRev rev of the receipt
   * @param blobType receipt blob type
   * @param body content of the attachment, already encrypted
   */
  async setReceiptAttachmentForBlobType(receiptId: string, receiptRev: string, blobType: string, body: ArrayBuffer): Promise<Receipt> {
    if (!receiptRev) throw new Error('Receipt rev is required')

    let _body = body

    const _url =
      this.host +
      `/receipt/${encodeURIComponent(String(receiptId))}/attachment/${encodeURIComponent(String(blobType))}` +
      '?ts=' +
      new Date().getTime() +
      '&rev=' +
      receiptRev
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Receipt(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareReceipt(request: {
    [entityId: string]: { [requestId: string]: EntityShareOrMetadataUpdateRequest }
  }): Promise<EntityBulkShareResult<Receipt>[]> {
    const _url = this.host + '/classification/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<Receipt>(x, Receipt)))
      .catch((err) => this.handleError(err))
  }
}
