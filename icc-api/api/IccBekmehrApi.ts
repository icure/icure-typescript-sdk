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
import { CheckSMFPatientResult } from '../model/CheckSMFPatientResult'
import { Content } from '../model/Content'
import { DiaryNoteExportInfo } from '../model/DiaryNoteExportInfo'
import { ImportMapping } from '../model/ImportMapping'
import { ImportResult } from '../model/ImportResult'
import { MedicationSchemeExportInfo } from '../model/MedicationSchemeExportInfo'
import { SoftwareMedicalFileExport } from '../model/SoftwareMedicalFileExport'
import { SumehrContent } from '../model/SumehrContent'
import { SumehrExportInfo } from '../model/SumehrExportInfo'
import { SumehrValidity } from '../model/SumehrValidity'

export class IccBekmehrApi {
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
   * @summary Check whether patients in SMF already exists in DB
   * @param body
   * @param documentId
   * @param documentKey
   * @param patientId
   * @param language
   */
  checkIfSMFPatientsExists(
    documentId: string,
    documentKey?: string,
    patientId?: string,
    language?: string,
    body?: { [key: string]: Array<ImportMapping> }
  ): Promise<Array<CheckSMFPatientResult>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/smf/${encodeURIComponent(String(documentId))}/checkIfSMFPatientsExists` +
      '?ts=' +
      new Date().getTime() +
      (documentKey ? '&documentKey=' + encodeURIComponent(String(documentKey)) : '') +
      (patientId ? '&patientId=' + encodeURIComponent(String(patientId)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new CheckSMFPatientResult(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr contactreport
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateContactreportExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/contactreport/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Generate diarynote
   * @param body
   * @param patientId
   * @param language
   */
  generateDiaryNote(patientId: string, language: string, body?: DiaryNoteExportInfo): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/diarynote/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr labresult
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateLabresultExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/labresult/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Medicationscheme export
   * @param body
   * @param patientId
   * @param language
   * @param recipientSafe
   * @param version
   */
  generateMedicationSchemeExport(
    patientId: string,
    language: string,
    recipientSafe: string,
    version: number,
    body?: MedicationSchemeExportInfo
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/medicationscheme/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientSafe ? '&recipientSafe=' + encodeURIComponent(String(recipientSafe)) : '') +
      (version ? '&version=' + encodeURIComponent(String(version)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr note
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateNoteExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/note/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get KMEHR Patient Info export
   * @param patientId
   * @param language
   */
  generatePatientInfoExport(patientId: string, language?: string): Promise<ArrayBuffer> {
    let _body = null

    const _url =
      this.host +
      `/be_kmehr/patientinfo/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr prescription
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generatePrescriptionExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/prescription/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr report
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateReportExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/report/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr request
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateRequestExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/request/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get Kmehr result
   * @param body
   * @param patientId
   * @param id
   * @param date
   * @param language
   * @param recipientNihii
   * @param recipientSsin
   * @param recipientFirstName
   * @param recipientLastName
   * @param mimeType
   */
  generateResultExport(
    patientId: string,
    id: string,
    date: number,
    language: string,
    recipientNihii: string,
    recipientSsin: string,
    recipientFirstName: string,
    recipientLastName: string,
    mimeType: string,
    body?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/result/${encodeURIComponent(String(patientId))}/export/${encodeURIComponent(String(id))}` +
      '?ts=' +
      new Date().getTime() +
      (date ? '&date=' + encodeURIComponent(String(date)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (recipientNihii ? '&recipientNihii=' + encodeURIComponent(String(recipientNihii)) : '') +
      (recipientSsin ? '&recipientSsin=' + encodeURIComponent(String(recipientSsin)) : '') +
      (recipientFirstName ? '&recipientFirstName=' + encodeURIComponent(String(recipientFirstName)) : '') +
      (recipientLastName ? '&recipientLastName=' + encodeURIComponent(String(recipientLastName)) : '') +
      (mimeType ? '&mimeType=' + encodeURIComponent(String(mimeType)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/octet-stream'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get SMF (Software Medical File) export
   * @param body
   * @param patientId
   * @param language
   */
  generateSmfExport(patientId: string, language: string, body?: SoftwareMedicalFileExport): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/smf/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Generate sumehr
   * @param body
   * @param patientId
   * @param language
   */
  generateSumehr(patientId: string, language: string, body?: SumehrExportInfo): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehr/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Generate sumehr
   * @param body
   * @param patientId
   * @param language
   */
  generateSumehrV2(patientId: string, language: string, body?: SumehrExportInfo): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehrv2/${encodeURIComponent(String(patientId))}/export` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get sumehr elements
   * @param body
   * @param patientId
   */
  getSumehrContent(patientId: string, body?: SumehrExportInfo): Promise<SumehrContent> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehr/${encodeURIComponent(String(patientId))}/content` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new SumehrContent(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Check sumehr signature
   * @param body
   * @param patientId
   */
  getSumehrMd5(patientId: string, body?: SumehrExportInfo): Promise<Content> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehr/${encodeURIComponent(String(patientId))}/md5` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get sumehr elements
   * @param body
   * @param patientId
   */
  getSumehrV2Content(patientId: string, body?: SumehrExportInfo): Promise<SumehrContent> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehrv2/${encodeURIComponent(String(patientId))}/content` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new SumehrContent(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Check sumehr signature
   * @param body
   * @param patientId
   */
  getSumehrV2Md5(patientId: string, body?: SumehrExportInfo): Promise<Content> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehrv2/${encodeURIComponent(String(patientId))}/md5` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new Content(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Import MedicationScheme into patient(s) using existing document
   * @param body
   * @param documentId
   * @param documentKey
   * @param dryRun Dry run: do not save in database
   * @param patientId
   * @param language
   */
  importMedicationScheme(
    documentId: string,
    documentKey?: string,
    dryRun?: boolean,
    patientId?: string,
    language?: string,
    body?: { [key: string]: Array<ImportMapping> }
  ): Promise<Array<ImportResult>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/medicationscheme/${encodeURIComponent(String(documentId))}/import` +
      '?ts=' +
      new Date().getTime() +
      (documentKey ? '&documentKey=' + encodeURIComponent(String(documentKey)) : '') +
      (dryRun ? '&dryRun=' + encodeURIComponent(String(dryRun)) : '') +
      (patientId ? '&patientId=' + encodeURIComponent(String(patientId)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ImportResult(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Import SMF into patient(s) using existing document
   * @param body
   * @param documentId
   * @param documentKey
   * @param patientId
   * @param language
   * @param dryRun
   */
  importSmf(
    documentId: string,
    documentKey?: string,
    patientId?: string,
    language?: string,
    dryRun?: boolean,
    body?: { [key: string]: Array<ImportMapping> }
  ): Promise<Array<ImportResult>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/smf/${encodeURIComponent(String(documentId))}/import` +
      '?ts=' +
      new Date().getTime() +
      (documentKey ? '&documentKey=' + encodeURIComponent(String(documentKey)) : '') +
      (patientId ? '&patientId=' + encodeURIComponent(String(patientId)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '') +
      (dryRun ? '&dryRun=' + encodeURIComponent(String(dryRun)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ImportResult(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Import sumehr into patient(s) using existing document
   * @param body
   * @param documentId
   * @param documentKey
   * @param dryRun Dry run: do not save in database
   * @param patientId
   * @param language
   */
  importSumehr(
    documentId: string,
    documentKey?: string,
    dryRun?: boolean,
    patientId?: string,
    language?: string,
    body?: { [key: string]: Array<ImportMapping> }
  ): Promise<Array<ImportResult>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehr/${encodeURIComponent(String(documentId))}/import` +
      '?ts=' +
      new Date().getTime() +
      (documentKey ? '&documentKey=' + encodeURIComponent(String(documentKey)) : '') +
      (dryRun ? '&dryRun=' + encodeURIComponent(String(dryRun)) : '') +
      (patientId ? '&patientId=' + encodeURIComponent(String(patientId)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ImportResult(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Import sumehr into patient(s) using existing document
   * @param body
   * @param documentId
   * @param itemId
   * @param documentKey
   * @param dryRun Dry run: do not save in database
   * @param patientId
   * @param language
   */
  importSumehrByItemId(
    documentId: string,
    itemId: string,
    documentKey?: string,
    dryRun?: boolean,
    patientId?: string,
    language?: string,
    body?: { [key: string]: Array<ImportMapping> }
  ): Promise<Array<ImportResult>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehr/${encodeURIComponent(String(documentId))}/importbyitemid` +
      '?ts=' +
      new Date().getTime() +
      (itemId ? '&itemId=' + encodeURIComponent(String(itemId)) : '') +
      (documentKey ? '&documentKey=' + encodeURIComponent(String(documentKey)) : '') +
      (dryRun ? '&dryRun=' + encodeURIComponent(String(dryRun)) : '') +
      (patientId ? '&patientId=' + encodeURIComponent(String(patientId)) : '') +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => (doc.body as Array<JSON>).map((it) => new ImportResult(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get sumehr validity
   * @param body
   * @param patientId
   */
  isSumehrV2Valid(patientId: string, body?: SumehrExportInfo): Promise<SumehrValidity> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehrv2/${encodeURIComponent(String(patientId))}/valid` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new SumehrValidity(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Get sumehr validity
   * @param body
   * @param patientId
   */
  isSumehrValid(patientId: string, body?: SumehrExportInfo): Promise<SumehrValidity> {
    let _body = null
    _body = body

    const _url = this.host + `/be_kmehr/sumehr/${encodeURIComponent(String(patientId))}/valid` + '?ts=' + new Date().getTime()
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => new SumehrValidity(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Validate sumehr
   * @param body
   * @param patientId
   * @param language
   */
  validateSumehr(patientId: string, language: string, body?: SumehrExportInfo): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehr/${encodeURIComponent(String(patientId))}/validate` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Validate sumehr
   * @param body
   * @param patientId
   * @param language
   */
  validateSumehrV2(patientId: string, language: string, body?: SumehrExportInfo): Promise<ArrayBuffer> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/be_kmehr/sumehrv2/${encodeURIComponent(String(patientId))}/validate` +
      '?ts=' +
      new Date().getTime() +
      (language ? '&language=' + encodeURIComponent(String(language)) : '')
    let headers = this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl)
      .then((doc) => doc.body)
      .catch((err) => this.handleError(err))
  }
}
