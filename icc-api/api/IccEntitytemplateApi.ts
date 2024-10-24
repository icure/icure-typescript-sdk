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
import { EntityTemplate } from '../model/EntityTemplate'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

export class IccEntitytemplateApi {
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
   * Type, EntityTemplate and Version are required.
   * @summary Create a EntityTemplate
   * @param body
   */
  createEntityTemplate(body?: EntityTemplate): Promise<EntityTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/entitytemplate` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new EntityTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified entityTemplates.
   * @summary Create a batch of entityTemplates
   * @param body
   */
  createEntityTemplates(body?: Array<EntityTemplate>): Promise<Array<EntityTemplate>> {
    let _body = null
    _body = body

    const _url = this.host + `/entitytemplate/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Delete entity templates
   * @param entityTemplateIds
   */
  deleteEntityTemplate(entityTemplateIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/entitytemplate/${encodeURIComponent(String(entityTemplateIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of entityTemplates matched with given input.
   * @summary Finding entityTemplates by entityTemplate, type and version with pagination.
   * @param type
   * @param searchString
   * @param includeEntities
   */
  findAllEntityTemplates(type: string, searchString?: string, includeEntities?: boolean): Promise<Array<EntityTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/entitytemplate/findAll/${encodeURIComponent(String(type))}` +
      '?ts=' +
      new Date().getTime() +
      (searchString ? '&searchString=' + encodeURIComponent(String(searchString)) : '') +
      (includeEntities ? '&includeEntities=' + encodeURIComponent(String(includeEntities)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of entityTemplates matched with given input.
   * @summary Finding entityTemplates by entityTemplate, type and version with pagination.
   * @param type
   * @param keyword
   * @param includeEntities
   */
  findAllEntityTemplatesByKeyword(type: string, keyword: string, includeEntities?: boolean): Promise<Array<EntityTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/entitytemplate/findAll/${encodeURIComponent(String(type))}/keyword/${encodeURIComponent(String(keyword))}` +
      '?ts=' +
      new Date().getTime() +
      (includeEntities ? '&includeEntities=' + encodeURIComponent(String(includeEntities)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of entityTemplates matched with given input.
   * @summary Finding entityTemplates by userId, entityTemplate, type and version with pagination.
   * @param userId
   * @param type
   * @param searchString
   * @param includeEntities
   */
  findEntityTemplates(userId: string, type: string, searchString?: string, includeEntities?: boolean): Promise<Array<EntityTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/entitytemplate/find/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(type))}` +
      '?ts=' +
      new Date().getTime() +
      (searchString ? '&searchString=' + encodeURIComponent(String(searchString)) : '') +
      (includeEntities ? '&includeEntities=' + encodeURIComponent(String(includeEntities)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of entityTemplates matched with given input.
   * @summary Finding entityTemplates by userId, type and keyword.
   * @param userId
   * @param type
   * @param keyword
   * @param includeEntities
   */
  findEntityTemplatesByKeyword(userId: string, type: string, keyword: string, includeEntities?: boolean): Promise<Array<EntityTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/entitytemplate/find/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(type))}/keyword/${encodeURIComponent(
        String(keyword)
      )}` +
      '?ts=' +
      new Date().getTime() +
      (includeEntities ? '&includeEntities=' + encodeURIComponent(String(includeEntities)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Get a entityTemplate based on ID or (entityTemplate,type,version) as query strings. (entityTemplate,type,version) is unique.
   * @summary Get a entityTemplate
   * @param entityTemplateId EntityTemplate id
   */
  getEntityTemplate(entityTemplateId: string): Promise<EntityTemplate> {
    let _body = null

    const _url = this.host + `/entitytemplate/${encodeURIComponent(String(entityTemplateId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new EntityTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Get a list of entityTemplates by ids
   * @param entityTemplateIds
   */
  getEntityTemplates(entityTemplateIds: string): Promise<Array<EntityTemplate>> {
    let _body = null

    const _url = this.host + `/entitytemplate/byIds/${encodeURIComponent(String(entityTemplateIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Modification of (type, entityTemplate, version) is not allowed.
   * @summary Modify a entityTemplate
   * @param body
   */
  modifyEntityTemplate(body?: EntityTemplate): Promise<EntityTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/entitytemplate` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new EntityTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified entityTemplates.
   * @summary Modify a batch of entityTemplates
   * @param body
   */
  modifyEntityTemplates(body?: Array<EntityTemplate>): Promise<Array<EntityTemplate>> {
    let _body = null
    _body = body

    const _url = this.host + `/entitytemplate/batch` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new EntityTemplate(it)))
      .catch((err) => this.handleError(err))
  }
}
