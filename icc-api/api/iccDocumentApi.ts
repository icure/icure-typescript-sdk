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
import { XHR } from "./XHR"
import { DocIdentifier } from "../model/DocIdentifier"
import { DocumentDto } from "../model/DocumentDto"
import { IcureStubDto } from "../model/IcureStubDto"
import { ListOfIdsDto } from "../model/ListOfIdsDto"

export class iccDocumentApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
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
   *
   * @summary Creates a document
   * @param body
   */
  createDocument(body?: DocumentDto): Promise<DocumentDto> {
    let _body = null
    _body = body

    const _url = this.host + `/document` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes a document's attachment
   * @param documentId
   */
  deleteAttachment(documentId: string): Promise<DocumentDto> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes a document
   * @param documentIds
   */
  deleteDocument(documentIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentIds))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("DELETE", _url, headers, _body, this.fetchImpl)
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
  findByTypeHCPartyMessageSecretFKeys(
    documentTypeCode: string,
    hcPartyId: string,
    secretFKeys: string
  ): Promise<Array<DocumentDto>> {
    let _body = null

    const _url =
      this.host +
      `/document/byTypeHcPartySecretForeignKeys` +
      "?ts=" +
      new Date().getTime() +
      (documentTypeCode
        ? "&documentTypeCode=" + encodeURIComponent(String(documentTypeCode))
        : "") +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List documents found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  findDocumentsByHCPartyPatientForeignKeys(
    hcPartyId: string,
    secretFKeys: string
  ): Promise<Array<DocumentDto>> {
    let _body = null

    const _url =
      this.host +
      `/document/byHcPartySecretForeignKeys` +
      "?ts=" +
      new Date().getTime() +
      (hcPartyId ? "&hcPartyId=" + encodeURIComponent(String(hcPartyId)) : "") +
      (secretFKeys ? "&secretFKeys=" + encodeURIComponent(String(secretFKeys)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary List documents with no delegation
   * @param limit
   */
  findWithoutDelegation(limit?: number): Promise<Array<DocumentDto>> {
    let _body = null

    const _url =
      this.host +
      `/document/woDelegation` +
      "?ts=" +
      new Date().getTime() +
      (limit ? "&limit=" + encodeURIComponent(String(limit)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a document
   * @param documentId
   */
  getDocument(documentId: string): Promise<DocumentDto> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
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
  getDocumentAttachment(
    documentId: string,
    attachmentId: string,
    enckeys?: string,
    fileName?: string
  ): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment/${encodeURIComponent(
        String(attachmentId)
      )}` +
      "?ts=" +
      new Date().getTime() +
      (enckeys ? "&enckeys=" + encodeURIComponent(String(enckeys)) : "") +
      (fileName ? "&fileName=" + encodeURIComponent(String(fileName)) : "")
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a document
   * @param externalUuid
   */
  getDocumentByExternalUuid(externalUuid: string): Promise<DocumentDto> {
    let _body = null

    const _url =
      this.host +
      `/document/externaluuid/${encodeURIComponent(String(externalUuid))}` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a document
   * @param body
   */
  getDocuments(body?: ListOfIdsDto): Promise<Array<DocumentDto>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/batch` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get all documents with externalUuid
   * @param externalUuid
   */
  getDocumentsByExternalUuid(externalUuid: string): Promise<Array<DocumentDto>> {
    let _body = null

    const _url =
      this.host +
      `/document/externaluuid/${encodeURIComponent(String(externalUuid))}/all` +
      "?ts=" +
      new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand("GET", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Updates a document
   * @param body
   */
  modifyDocument(body?: DocumentDto): Promise<DocumentDto> {
    let _body = null
    _body = body

    const _url = this.host + `/document` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified documents.
   * @summary Updates a batch of documents
   * @param body
   */
  modifyDocuments(body?: Array<DocumentDto>): Promise<Array<DocumentDto>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/batch` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param body
   * @param documentId
   * @param enckeys
   */
  setDocumentAttachment(
    documentId: string,
    enckeys?: string,
    body?: ArrayBuffer
  ): Promise<DocumentDto> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment` +
      "?ts=" +
      new Date().getTime() +
      (enckeys ? "&enckeys=" + encodeURIComponent(String(enckeys)) : "")
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param attachment
   * @param documentId
   * @param enckeys
   */
  setDocumentAttachmentMulti(
    documentId: string,
    attachment?: ArrayBuffer | any[],
    enckeys?: string
  ): Promise<DocumentDto> {
    let _body = null
    if (attachment && !_body) {
      const parts = Array.isArray(attachment) ? (attachment as any[]) : [attachment as ArrayBuffer]
      const _blob = new Blob(parts, { type: "application/octet-stream" })
      _body = new FormData()
      _body.append("attachment", _blob)
    }

    const _url =
      this.host +
      `/document/${encodeURIComponent(String(documentId))}/attachment/multipart` +
      "?ts=" +
      new Date().getTime() +
      (enckeys ? "&enckeys=" + encodeURIComponent(String(enckeys)) : "")
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "multipart/form-data"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in healthElements.
   * @param body
   */
  setDocumentsDelegations(body?: Array<IcureStubDto>): Promise<Array<IcureStubDto>> {
    let _body = null
    _body = body

    const _url = this.host + `/document/delegations` + "?ts=" + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/json"))
    return XHR.sendCommand("POST", _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStubDto(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param body
   * @param documentId
   * @param enckeys
   */
  setSafeDocumentAttachment(
    documentId: string,
    enckeys?: string,
    body?: ArrayBuffer
  ): Promise<DocumentDto> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/document/attachment` +
      "?ts=" +
      new Date().getTime() +
      (documentId ? "&documentId=" + encodeURIComponent(String(documentId)) : "") +
      (enckeys ? "&enckeys=" + encodeURIComponent(String(enckeys)) : "")
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== "Content-Type")
      .concat(new XHR.Header("Content-Type", "application/octet-stream"))
    return XHR.sendCommand("PUT", _url, headers, _body, this.fetchImpl)
      .then((doc) => new DocumentDto(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
