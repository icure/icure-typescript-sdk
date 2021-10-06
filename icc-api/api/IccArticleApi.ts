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
import { Article } from '../model/Article'
import { DocIdentifier } from '../model/DocIdentifier'

export class IccArticleApi {
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
   *
   * @summary Creates a article
   * @param body
   */
  createArticle(body?: Article): Promise<Article> {
    let _body = null
    _body = body

    const _url = this.host + `/article` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Article(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Deletes an article
   * @param articleIds
   */
  deleteArticle(articleIds: string): Promise<Array<DocIdentifier>> {
    let _body = null

    const _url = this.host + `/article/${encodeURIComponent(String(articleIds))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets an article
   * @param articleId
   */
  getArticle(articleId: string): Promise<Article> {
    let _body = null

    const _url = this.host + `/article/${encodeURIComponent(String(articleId))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Article(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all articles
   */
  getArticles(): Promise<Array<Article>> {
    let _body = null

    const _url = this.host + `/article` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Article(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Modifies an article
   * @param body
   */
  modifyArticle(body?: Article): Promise<Article> {
    let _body = null
    _body = body

    const _url = this.host + `/article` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Article(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }
}
