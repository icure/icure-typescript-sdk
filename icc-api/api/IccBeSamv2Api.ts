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
import { Amp } from '../model/Amp'
import { ListOfIds } from '../model/ListOfIds'
import { Nmp } from '../model/Nmp'
import { PaginatedListAmp } from '../model/PaginatedListAmp'
import { PaginatedListNmp } from '../model/PaginatedListNmp'
import { PaginatedListVmp } from '../model/PaginatedListVmp'
import { PaginatedListVmpGroup } from '../model/PaginatedListVmpGroup'
import { PharmaceuticalForm } from '../model/PharmaceuticalForm'
import { SamVersion } from '../model/SamVersion'
import { Substance } from '../model/Substance'
import { Vmp } from '../model/Vmp'
import { VmpGroup } from '../model/VmpGroup'

export class IccBesamv2Api {
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
   * Returns a list of amps matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by dmpp code
   * @param dmppCode dmppCode
   */
  findAmpsByDmppCode(dmppCode: string): Promise<Array<Amp>> {
    let _body = null

    const _url = this.host + `/be_samv2/amp/byDmppCode/${encodeURIComponent(String(dmppCode))}` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by atc code with pagination.
   * @param atcCode atcCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A amp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByAtc(atcCode: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmp/byAtc/${encodeURIComponent(String(atcCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by group with pagination.
   * @param vmpgCode vmpgCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByGroupCode(vmpgCode: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/amp/byGroupCode/${encodeURIComponent(String(vmpgCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by group with pagination.
   * @param vmpgId vmpgCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByGroupId(vmpgId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/amp/byGroupId/${encodeURIComponent(String(vmpgId))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by label with pagination.
   * @param language language
   * @param label label
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId An amp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByLabel(
    language?: string,
    label?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/amp` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (label ? '&label=' + encodeURIComponent(String(label)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by vmp code with pagination.
   * @param vmpCode vmpCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A amp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByVmpCode(vmpCode: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/amp/byVmpCode/${encodeURIComponent(String(vmpCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by vmp id with pagination.
   * @param vmpId vmpgCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A amp document ID
   * @param limit Number of rows
   */
  findPaginatedAmpsByVmpId(vmpId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListAmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/amp/byVmpId/${encodeURIComponent(String(vmpId))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListAmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a paginated list of NMPs by matching label. Matches occur per word
   * @summary Finding NMPs by label with pagination.
   * @param language language
   * @param label label
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedNmpsByLabel(
    language?: string,
    label?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListNmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/nmp` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (label ? '&label=' + encodeURIComponent(String(label)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListNmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMP groups by language label with pagination.
   * @param language language
   * @param label label
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmpgroup document ID
   * @param limit Number of rows
   */
  findPaginatedVmpGroupsByLabel(
    language?: string,
    label?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListVmpGroup> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmpgroup` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (label ? '&label=' + encodeURIComponent(String(label)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmpGroup(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMP groups by cmpgCode with pagination.
   * @param vmpgCode vmpgCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmpgroup document ID
   * @param limit Number of rows
   */
  findPaginatedVmpGroupsByVmpGroupCode(
    vmpgCode: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListVmpGroup> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmpgroup/byGroupCode/${encodeURIComponent(String(vmpgCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmpGroup(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMPs by group with pagination.
   * @param vmpgCode vmpgCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedVmpsByGroupCode(vmpgCode: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListVmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmp/byGroupCode/${encodeURIComponent(String(vmpgCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMPs by group with pagination.
   * @param vmpgId vmpgId
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedVmpsByGroupId(vmpgId: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListVmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmp/byGroupId/${encodeURIComponent(String(vmpgId))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a paginated list of VMPs by matching label. Matches occur per word
   * @summary Finding VMPs by label with pagination.
   * @param language language
   * @param label label
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedVmpsByLabel(
    language?: string,
    label?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListVmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmp` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (label ? '&label=' + encodeURIComponent(String(label)) : '') +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMPs by group with pagination.
   * @param vmpCode vmpCode
   * @param startKey The start key for pagination: a JSON representation of an array containing all the necessary components to form the Complex Key&#x27;s startKey
   * @param startDocumentId A vmp document ID
   * @param limit Number of rows
   */
  findPaginatedVmpsByVmpCode(vmpCode: string, startKey?: string, startDocumentId?: string, limit?: number): Promise<PaginatedListVmp> {
    let _body = null

    const _url =
      this.host +
      `/be_samv2/vmp/byVmpCode/${encodeURIComponent(String(vmpCode))}` +
      '?ts=' +
      new Date().getTime() +
      (startKey ? '&startKey=' + encodeURIComponent(String(startKey)) : '') +
      (startDocumentId ? '&startDocumentId=' + encodeURIComponent(String(startDocumentId)) : '') +
      (limit ? '&limit=' + encodeURIComponent(String(limit)) : '')
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new PaginatedListVmp(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Get Samv2 version.
   */
  getSamVersion(): Promise<SamVersion> {
    let _body = null

    const _url = this.host + `/be_samv2/v` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => new SamVersion(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of amps matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by dmpp code
   * @param body
   */
  listAmpsByDmppCodes(body?: ListOfIds): Promise<Array<Amp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/amp/byDmppCodes` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by group.
   * @param body
   */
  listAmpsByGroupCodes(body?: ListOfIds): Promise<Array<Amp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/amp/byGroupCodes` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by group.
   * @param body
   */
  listAmpsByGroupIds(body?: ListOfIds): Promise<Array<Amp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/amp/byGroupIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by vmp code.
   * @param body
   */
  listAmpsByVmpCodes(body?: ListOfIds): Promise<Array<Amp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/amp/byVmpCodes` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by vmp id.
   * @param body
   */
  listAmpsByVmpIds(body?: ListOfIds): Promise<Array<Amp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/amp/byVmpIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Amp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding NMPs by cnk id.
   * @param body
   */
  listNmpsByCnks(body?: ListOfIds): Promise<Array<Nmp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/nmp/byCnks` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Nmp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List all pharmaceutical forms.
   */
  listPharmaceuticalForms(): Promise<Array<PharmaceuticalForm>> {
    let _body = null

    const _url = this.host + `/be_samv2/pharmaform` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new PharmaceuticalForm(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary List all substances.
   */
  listSubstances(): Promise<Array<Substance>> {
    let _body = null

    const _url = this.host + `/be_samv2/substance` + '?ts=' + new Date().getTime()
    let headers = this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Substance(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of group codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding AMPs by group.
   * @param body
   */
  listVmpGroupsByVmpGroupCodes(body?: ListOfIds): Promise<Array<VmpGroup>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/vmpgroup/byGroupCodes` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new VmpGroup(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMPs by group.
   * @param body
   */
  listVmpsByGroupIds(body?: ListOfIds): Promise<Array<Vmp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/vmp/byGroupIds` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Vmp(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns a list of codes matched with given input. If several types are provided, paginantion is not supported
   * @summary Finding VMPs by group.
   * @param body
   */
  listVmpsByVmpCodes(body?: ListOfIds): Promise<Array<Vmp>> {
    let _body = null
    _body = body

    const _url = this.host + `/be_samv2/vmp/byVmpCodes` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Vmp(it)))
      .catch((err) => this.handleError(err))
  }
}
