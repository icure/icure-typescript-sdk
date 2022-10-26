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
import { Document } from '../model/Document'
import { IcureStub } from '../model/IcureStub'
import { ListOfIds } from '../model/ListOfIds'

export class IccDocumentApi {
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
   * Creates a document and returns an instance of created document afterward
   * @summary Create a document
   * @param body
   */
  createDocument(body?: Document): Promise<Document> {
    let _body = null
    _body = body

    const _url = this.host + `/document` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Deletes a document's attachment and returns the modified document instance afterward
   * @summary Delete a document's attachment
   * @param documentId
   */
  deleteAttachment(documentId: string): Promise<Document> {
    let _body = null

    const _url = this.host + `/document/${encodeURIComponent(String(documentId))}/attachment` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Deletes a batch of documents and returns the list of deleted document ids
   * @summary Delete a document
   * @param documentIds
   */
  deleteDocument(documentIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/document/${encodeURIComponent(String(documentIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List documents found By type, By Healthcare Party and secret foreign keys.
   * @param documentTypeCode
   * @param hcPartyId
   * @param secretFKeys
   */
  findByTypeHCPartyMessageSecretFKeys(documentTypeCode: string, hcPartyId: string, secretFKeys: string): Promise<Array<Document>> {
    let _body = null

    const _url =
      this.host +
      `/document/byTypeHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (documentTypeCode ? '&documentTypeCode=' + encodeURIComponent(String(documentTypeCode)) : '') +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List documents found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  findDocumentsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<Document>> {
    let _body = null

    const _url =
      this.host +
      `/document/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List documents with no delegation
   * @param limit
   */
  findWithoutDelegation(limit?: number): Promise<Array<Document>> {
    let _body = null

    const _url = this.host + `/document/woDelegation` + '?ts=' + new Date().getTime() + (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the document corresponding to the identifier passed in the request
   * @summary Get a document
   * @param documentId
   */
  getDocument(documentId: string): Promise<Document> {
    let _body = null

    const _url = this.host + `/document/${encodeURIComponent(String(documentId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Load document's attachment
   * @param documentId
   * @param attachmentId
   * @param enckeys
   * @param fileName
   */
  getDocumentAttachment(documentId: string, attachmentId: string, enckeys?: string, fileName?: string): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment/${encodeURIComponent(String(attachmentId))}` +
      '?ts=' +
      new Date().getTime() +
      (enckeys ? '&enckeys=' + encodeURIComponent(String(enckeys)) : '') +
      (fileName ? '&fileName=' + encodeURIComponent(String(fileName)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the first document corresponding to the externalUuid passed in the request
   * @summary Get a document
   * @param externalUuid
   */
  getDocumentByExternalUuid(externalUuid: string): Promise<Document> {
    let _body = null

    const _url = this.host + `/document/externaluuid/${encodeURIComponent(String(externalUuid))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of document corresponding to the identifiers passed in the body
   * @summary Get a batch of document
   * @param body
   */
  getDocuments(body?: ListOfIds): Promise<Array<Document>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of document corresponding to the externalUuid passed in the request
   * @summary Get all documents with externalUuid
   * @param externalUuid
   */
  getDocumentsByExternalUuid(externalUuid: string): Promise<Array<Document>> {
    let _body = null

    const _url = this.host + `/document/externaluuid/${encodeURIComponent(String(externalUuid))}/all` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Updates the document and returns an instance of the modified document afterward
   * @summary Update a document
   * @param body
   */
  modifyDocument(body?: Document): Promise<Document> {
    let _body = null
    _body = body

    const _url = this.host + `/document` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified documents.
   * @summary Update a batch of documents
   * @param body
   */
  modifyDocuments(body?: Array<Document>): Promise<Array<Document>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Document(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Creates a document's attachment and returns the modified document instance afterward
   * @summary Create a document's attachment
   * @param body
   * @param documentId
   * @param enckeys
   */
  setDocumentAttachment(documentId: string, enckeys?: string, body?: Object): Promise<Document> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment` +
      '?ts=' +
      new Date().getTime() +
      (enckeys ? '&enckeys=' + encodeURIComponent(String(enckeys)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Creates a document attachment and returns the modified document instance afterward
   * @summary Create a document's attachment
   * @param body
   * @param documentId
   * @param enckeys
   */
  setDocumentAttachmentBody(documentId: string, enckeys?: string, body?: Object): Promise<Document> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/document/attachment` +
      '?ts=' +
      new Date().getTime() +
      (documentId ? '&documentId=' + encodeURIComponent(String(documentId)) : '') +
      (enckeys ? '&enckeys=' + encodeURIComponent(String(enckeys)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param attachment
   * @param documentId
   * @param enckeys
   */
  setDocumentAttachmentMulti(attachment: ArrayBuffer, documentId: string, enckeys?: string): Promise<Document> {
    let _body = null
    if (attachment && !_body) {
      const parts = Array.isArray(attachment) ? (attachment as any[]) : [attachment as ArrayBuffer]
      const _blob = new Blob(parts, { type: 'application/octet-stream' })
      _body = new FormData()
      _body.append('attachment', _blob)
    }

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment/multipart` +
      '?ts=' +
      new Date().getTime() +
      (enckeys ? '&enckeys=' + encodeURIComponent(String(enckeys)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'multipart/form-data'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in healthElements.
   * @param body
   */
  setDocumentsDelegations(body?: Array<IcureStub>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/delegations` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Creates a secondary attachment for a document and returns the modified document instance afterward
   * @summary Creates or modifies a secondary attachment for a document
   * @param documentId id of the document to update
   * @param key Key of the secondary attachment to update
   * @param rev Revision of the latest known version of the document. If the revision does not match the current version of the document the method
   * will fail with CONFLICT status
   * @param attachment
   * @param utis Utis for the attachment
   * @return the updated document
   */
  setSecondaryAttachment(documentId: string, key: string, rev: string, attachment: Object, utis?: Array<string>): Promise<Document> {
    const _url =
      this.host +
      `/document/` +
      encodeURIComponent(String(documentId)) +
      '/secondaryAttachments/' +
      encodeURIComponent(String(key)) +
      '?ts=' +
      new Date().getTime() +
      (rev ? '&rev=' + encodeURIComponent(String(rev)) : '') +
      (utis ? utis.map((x) => '&utis=' + encodeURIComponent(String(x))).join('') : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, attachment, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get the secondary attachment with the provided key for a document
   * @summary Retrieve a secondary attachment of a document
   * @param documentId id of the document
   * @param key Key of the secondary attachment to retrieve
   * @param fileName
   * @return the content of the attachment
   */
  getSecondaryAttachment(documentId: string, key: string, fileName?: string): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/secondaryAttachments/${encodeURIComponent(String(key))}` +
      '?ts=' +
      new Date().getTime() +
      (fileName ? '&fileName=' + encodeURIComponent(String(fileName)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   * Deletes a document's attachment and returns the modified document instance afterward
   * @summary Delete a document's attachment
   * @param documentId id of the document
   * @param key Key of the secondary attachment to delete
   * @param rev Revision of the latest known version of the document. If the revision does not match the current version of the document the method will fail with CONFLICT status
   * @return the updated document
   */
  deleteSecondaryAttachment(documentId: string, key: string, rev: string): Promise<Document> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/secondaryAttachments/${encodeURIComponent(String(key))}` +
      '?ts=' +
      new Date().getTime() +
      (rev ? '&rev=' + encodeURIComponent(String(rev)) : '')
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Document(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  // TODO single request multi-attachment update
}
