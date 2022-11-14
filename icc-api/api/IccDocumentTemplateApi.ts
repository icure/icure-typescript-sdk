/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure.
 *
 * OpenAPI spec version: v0
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { XHR } from './XHR'
import { ByteArray } from '../model/ByteArray'
import { DocIdentifier } from '../model/DocIdentifier'
import { DocumentTemplate } from '../model/DocumentTemplate'
import { ListOfIds } from '../model/ListOfIds'
import { AuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccDocumentTemplateApi {
  host: string
  headers: Array<XHR.Header>
  authenticationProvider: AuthenticationProvider
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: any,
    authenticationProvider: AuthenticationProvider,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  ) {
    this.host = host
    this.headers = Object.keys(headers).map((k) => new XHR.Header(k, headers[k]))
    this.authenticationProvider = authenticationProvider
    this.fetchImpl = fetchImpl
  }

  setHeaders(h: Array<XHR.Header>) {
    this.headers = h
  }

  handleError(e: XHR.XHRError): never {
    throw e
  }

  /**
   * Returns an instance of created document template.
   * @summary Create a document template with the current user
   * @param body
   */
  createDocumentTemplate(body?: DocumentTemplate): Promise<DocumentTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/rest/v2/doctemplate` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocumentTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes document templates
   * @param body
   */
  deleteDocumentTemplates(body?: ListOfIds): Promise<Array<DocIdentifier>> {
    let _body = null
    _body = body

    const _url = this.host + `/rest/v2/doctemplate/delete/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Download a the document template attachment
   * @param documentTemplateId
   * @param attachmentId
   */
  getAttachmentText(documentTemplateId: string, attachmentId: string): Promise<ArrayBuffer> {
    const _body = null

    const _url =
      this.host +
      `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}/attachmentText/${encodeURIComponent(String(attachmentId))}` +
      '?ts=' +
      new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a document template
   * @param documentTemplateId
   */
  getDocumentTemplate(documentTemplateId: string): Promise<DocumentTemplate> {
    const _body = null

    const _url = this.host + `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocumentTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Download a the document template attachment
   * @param documentTemplateId
   * @param attachmentId
   */
  getDocumentTemplateAttachment(documentTemplateId: string, attachmentId: string): Promise<ArrayBuffer> {
    const _body = null

    const _url =
      this.host +
      `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}/attachment/${encodeURIComponent(String(attachmentId))}` +
      '?ts=' +
      new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all document templates for all users
   */
  listAllDocumentTemplates(): Promise<Array<DocumentTemplate>> {
    const _body = null

    const _url = this.host + `/rest/v2/doctemplate/find/all` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all document templates for current user
   */
  listDocumentTemplates(): Promise<Array<DocumentTemplate>> {
    const _body = null

    const _url = this.host + `/rest/v2/doctemplate` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all document templates by Type
   * @param documentTypeCode
   */
  listDocumentTemplatesByDocumentType(documentTypeCode: string): Promise<Array<DocumentTemplate>> {
    const _body = null

    const _url = this.host + `/rest/v2/doctemplate/byDocumentType/${encodeURIComponent(String(documentTypeCode))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all document templates by Type For currentUser
   * @param documentTypeCode
   */
  listDocumentTemplatesByDocumentTypeForCurrentUser(documentTypeCode: string): Promise<Array<DocumentTemplate>> {
    const _body = null

    const _url =
      this.host + `/rest/v2/doctemplate/byDocumentTypeForCurrentUser/${encodeURIComponent(String(documentTypeCode))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all document templates
   * @param specialityCode
   */
  listDocumentTemplatesBySpeciality(specialityCode: string): Promise<Array<DocumentTemplate>> {
    const _body = null

    const _url = this.host + `/rest/v2/doctemplate/bySpecialty/${encodeURIComponent(String(specialityCode))}` + '?ts=' + new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocumentTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns an instance of created document template.
   * @summary Modify a document template with the current user
   * @param body
   * @param documentTemplateId
   */
  modifyDocumentTemplate(documentTemplateId: string, body?: DocumentTemplate): Promise<DocumentTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocumentTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param body
   * @param documentTemplateId
   */
  setDocumentTemplateAttachment(documentTemplateId: string, body?: ArrayBuffer): Promise<DocumentTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}/attachment` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocumentTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Creates a document's attachment
   * @param body
   * @param documentTemplateId
   */
  setDocumentTemplateAttachmentJson(documentTemplateId: string, body?: string): Promise<DocumentTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/rest/v2/doctemplate/${encodeURIComponent(String(documentTemplateId))}/attachmentJson` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocumentTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
