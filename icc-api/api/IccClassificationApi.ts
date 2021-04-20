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
import { XHR } from './XHR'
import { Classification } from '../model/Classification'
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { IcureStub } from '../model/IcureStub'

export class IccClassificationApi {
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
   * Returns an instance of created classification Template.
   * @summary Create a classification with the current user
   * @param body
   */
  createClassification(body?: Classification): Promise<Classification> {
    let _body = null
    _body = body

    const _url = this.host + `/classification` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Response is a set containing the ID's of deleted classification Templates.
   * @summary Delete classification Templates.
   * @param classificationIds
   */
  deleteClassifications(classificationIds: string): Promise<Array<DocIdentifier>> {
    const _body = null

    const _url =
      this.host +
      `/classification/${encodeURIComponent(String(classificationIds))}` +
      '?ts=' +
      new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys hast to delimited by coma
   * @summary List classification Templates found By Healthcare Party and secret foreign keyelementIds.
   * @param hcPartyId
   * @param secretFKeys
   */
  findClassificationsByHCPartyPatientForeignKeys(
    hcPartyId: string,
    secretFKeys: string
  ): Promise<Array<Classification>> {
    const _body = null

    const _url =
      this.host +
      `/classification/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Classification(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get a classification Template
   * @param classificationId
   */
  getClassification(classificationId: string): Promise<Classification> {
    const _body = null

    const _url =
      this.host +
      `/classification/${encodeURIComponent(String(classificationId))}` +
      '?ts=' +
      new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Ids are seperated by a coma
   * @summary Get a list of classifications
   * @param ids
   */
  getClassificationByHcPartyId(ids: string): Promise<Array<Classification>> {
    const _body = null

    const _url =
      this.host +
      `/classification/byIds/${encodeURIComponent(String(ids))}` +
      '?ts=' +
      new Date().getTime()
    const headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Classification(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified classification Template.
   * @summary Modify a classification Template
   * @param body
   */
  modifyClassification(body?: Classification): Promise<Classification> {
    let _body = null
    _body = body

    const _url = this.host + `/classification` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * It delegates a classification to a healthcare party (By current healthcare party). Returns the element with new delegations.
   * @summary Delegates a classification to a healthcare party
   * @param body
   * @param classificationId
   */
  newClassificationDelegations(
    classificationId: string,
    body?: Array<Delegation>
  ): Promise<Classification> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/classification/${encodeURIComponent(String(classificationId))}/delegate` +
      '?ts=' +
      new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Classification(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Update delegations in classification
   * @param body
   */
  setClassificationsDelegations(body?: Array<IcureStub>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url = this.host + `/classification/delegations` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers
      .filter((h) => h.header !== 'Content-Type')
      .concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }
}
