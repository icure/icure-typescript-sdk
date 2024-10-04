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
import { Delegation } from '../model/Delegation'
import { DocIdentifier } from '../model/DocIdentifier'
import { Form } from '../model/Form'
import { FormTemplate } from '../model/FormTemplate'
import { IcureStub } from '../model/IcureStub'
import { ListOfIds } from '../model/ListOfIds'
import { AuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { iccRestApiPath } from './IccRestApiPath'
import { EntityShareOrMetadataUpdateRequest } from '../model/requests/EntityShareOrMetadataUpdateRequest'
import { EntityBulkShareResult } from '../model/requests/EntityBulkShareResult'
import { MinimalEntityBulkShareResult } from '../model/requests/MinimalEntityBulkShareResult'
import { BulkShareOrUpdateMetadataParams } from '../model/requests/BulkShareOrUpdateMetadataParams'
import { PaginatedListForm } from '../model/PaginatedListForm'

export class IccFormApi {
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
   * Returns an instance of created form.
   * @summary Create a form with the current user
   * @param body
   */
  async createForm(body?: Form): Promise<Form> {
    const _url = this.host + `/form` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Form(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns an instance of created form template.
   * @summary Create a form template with the current user
   * @param body
   */
  async createFormTemplate(body?: FormTemplate): Promise<FormTemplate> {
    const _url = this.host + `/form/template` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FormTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the created forms.
   * @summary Create a batch of forms
   * @param body
   */
  async createForms(body?: Array<Form>): Promise<Array<Form>> {
    const _url = this.host + `/form/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Delete a form template
   * @param formTemplateId
   */
  async deleteFormTemplate(formTemplateId: string): Promise<DocIdentifier> {
    let _body = null

    const _url = this.host + `/form/template/${encodeURIComponent(String(formTemplateId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('DELETE', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new DocIdentifier(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Delete forms by batch.
   *
   * @param formIds a ListOfIds containing the ids of the Forms to delete.
   * @return a Promise that will resolve in an array of DocIdentifiers related to the successfully deleted Forms.
   */
  async deleteForms(formIds: ListOfIds): Promise<Array<DocIdentifier>> {
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand(
      'POST',
      this.host + `/form/delete/batch` + '?ts=' + new Date().getTime(),
      headers,
      formIds,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => (doc.body as Array<JSON>).map((it) => new DocIdentifier(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary Deletes a single form by id.
   *
   * @param formId the id of the document to delete.
   * @return a Promise that will resolve in the DocIdentifier of the form.
   */
  async deleteForm(formId: string): Promise<DocIdentifier> {
    return XHR.sendCommand(
      'DELETE',
      this.host + `/form/${encodeURIComponent(formId)}` + '?ts=' + new Date().getTime(),
      await this.headers,
      null,
      this.fetchImpl,
      undefined,
      this.authenticationProvider.getAuthService()
    )
      .then((doc) => new DocIdentifier(doc.body))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all form templates for current user
   * @param loadLayout
   * @param raw
   */
  async findFormTemplates(loadLayout?: boolean, raw?: boolean): Promise<Array<FormTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/form/template` +
      '?ts=' +
      new Date().getTime() +
      (loadLayout ? '&loadLayout=' + encodeURIComponent(String(loadLayout)) : '') +
      (raw ? '&raw=' + encodeURIComponent(String(raw)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new FormTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all form templates
   * @param specialityCode
   * @param loadLayout
   */
  async findFormTemplatesBySpeciality(specialityCode: string, loadLayout?: boolean, raw?: boolean): Promise<Array<FormTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/form/template/bySpecialty/${encodeURIComponent(String(specialityCode))}` +
      '?ts=' +
      new Date().getTime() +
      (loadLayout ? '&loadLayout=' + encodeURIComponent(String(loadLayout)) : '') +
      (raw ? '&raw=' + encodeURIComponent(String(raw)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new FormTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @deprecated use {@link findFormIdsByDataOwnerPatientOpeningDate} instead.
   * @summary List forms found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param healthElementId
   * @param planOfActionId
   * @param formTemplateId
   * @param body
   */
  async findFormsByHCPartyPatientForeignKeysUsingPost(
    hcPartyId: string,
    healthElementId?: string,
    planOfActionId?: string,
    formTemplateId?: string,
    body?: Array<string>
  ): Promise<Array<Form>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/form/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (healthElementId ? '&healthElementId=' + encodeURIComponent(String(healthElementId)) : '') +
      (planOfActionId ? '&planOfActionId=' + encodeURIComponent(String(planOfActionId)) : '') +
      (formTemplateId ? '&formTemplateId=' + encodeURIComponent(String(formTemplateId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by commas.
   * @deprecated use {@link findFormIdsByDataOwnerPatientOpeningDate} instead.
   * @summary List forms found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   * @param healthElementId
   * @param planOfActionId
   * @param formTemplateId
   */
  async findFormsByHCPartyPatientForeignKeys(
    hcPartyId: string,
    secretFKeys: string,
    healthElementId?: string,
    planOfActionId?: string,
    formTemplateId?: string
  ): Promise<Array<Form>> {
    let _body = null

    const _url =
      this.host +
      `/form/byHcPartySecretForeignKeys` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '') +
      (healthElementId ? '&healthElementId=' + encodeURIComponent(String(healthElementId)) : '') +
      (planOfActionId ? '&planOfActionId=' + encodeURIComponent(String(planOfActionId)) : '') +
      (formTemplateId ? '&formTemplateId=' + encodeURIComponent(String(formTemplateId)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary List Form ids by data owner and a set of secret foreign key. The ids will be sorted by Form openingDate, in ascending or descending
   * order according to the specified parameter value.
   *
   * @param dataOwnerId the data owner id.
   * @param secretFKeys an array of secret foreign keys.
   * @param startDate a timestamp in epoch milliseconds. If undefined, all the form ids since the beginning of time will be returned.
   * @param endDate a timestamp in epoch milliseconds. If undefined, all the form ids until the end of time will be returned.
   * @param descending whether to return the ids ordered in ascending or descending order by Form openingDate
   * @return a promise that will resolve in an Array of Form ids.
   */
  async findFormIdsByDataOwnerPatientOpeningDate(
    dataOwnerId: string,
    secretFKeys: string[],
    startDate?: number,
    endDate?: number,
    descending?: boolean
  ): Promise<string[]> {
    const _url =
      this.host +
      `/form/byDataOwnerPatientOpeningDate?ts=${new Date().getTime()}` +
      '&dataOwnerId=' +
      encodeURIComponent(dataOwnerId) +
      (!!startDate ? `&startDate=${encodeURIComponent(startDate)}` : '') +
      (!!endDate ? `&endDate=${encodeURIComponent(endDate)}` : '') +
      (!!descending ? `&descending=${descending}` : '')
    const headers = (await this.headers).filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    const body = new ListOfIds({ ids: secretFKeys })
    return XHR.sendCommand('POST', _url, headers, null, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => JSON.parse(JSON.stringify(it))))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @deprecated use {@link findFormsDelegationsStubsByIds} instead.
   * @summary List form stubs found By Healthcare Party and secret foreign keys.
   * @param body
   * @param hcPartyId
   */
  async findFormsDelegationsStubsByHCPartyPatientForeignKeysUsingPost(hcPartyId: string, body?: Array<string>): Promise<Array<IcureStub>> {
    let _body = null
    _body = body

    const _url =
      this.host +
      `/form/byHcPartySecretForeignKeys/delegations` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '')
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @deprecated use {@link findFormsDelegationsStubsByIds} instead.
   * @summary List form stubs found By Healthcare Party and secret foreign keys.
   * @param hcPartyId
   * @param secretFKeys
   */
  async findFormsDelegationsStubsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): Promise<Array<IcureStub>> {
    let _body = null

    const _url =
      this.host +
      `/form/byHcPartySecretForeignKeys/delegations` +
      '?ts=' +
      new Date().getTime() +
      (hcPartyId ? '&hcPartyId=' + encodeURIComponent(String(hcPartyId)) : '') +
      (secretFKeys ? '&secretFKeys=' + encodeURIComponent(String(secretFKeys)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @summary List form stubs by form ids.
   */
  async findFormsDelegationsStubsByIds(formIds: string[]): Promise<Array<IcureStub>> {
    const _url = this.host + `/form/delegations`
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, { ids: formIds }, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new IcureStub(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Get a list of forms by ids
   * @param formId
   * @param hcPartyId
   */
  async getChildrenForms(formId: string, hcPartyId: string): Promise<Array<Form>> {
    let _body = null

    const _url =
      this.host + `/form/childrenOf/${encodeURIComponent(String(formId))}/${encodeURIComponent(String(hcPartyId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a form
   * @param formId
   */
  async getForm(formId: string): Promise<Form> {
    let _body = null

    const _url = this.host + `/form/${encodeURIComponent(String(formId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Form(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets the most recent form with the given logicalUuid
   * @param logicalUuid
   */
  async getFormByLogicalUuid(logicalUuid: string): Promise<Form> {
    let _body = null

    const _url = this.host + `/form/logicalUuid/${encodeURIComponent(String(logicalUuid))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Form(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets the most recent form with the given uniqueId
   * @param uniqueId
   */
  async getFormByUniqueId(uniqueId: string): Promise<Form> {
    let _body = null

    const _url = this.host + `/form/uniqueId/${encodeURIComponent(String(uniqueId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Form(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a form template by guid
   * @param formTemplateId
   * @param raw
   */
  async getFormTemplate(formTemplateId: string, raw?: boolean): Promise<FormTemplate> {
    let _body = null

    const _url =
      this.host +
      `/form/template/${encodeURIComponent(String(formTemplateId))}` +
      '?ts=' +
      new Date().getTime() +
      (raw ? '&raw=' + encodeURIComponent(String(raw)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FormTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets a form template
   * @param formTemplateGuid
   * @param specialityCode
   * @param raw
   */
  async getFormTemplatesByGuid(formTemplateGuid: string, specialityCode: string, raw?: boolean): Promise<Array<FormTemplate>> {
    let _body = null

    const _url =
      this.host +
      `/form/template/${encodeURIComponent(String(specialityCode))}/guid/${encodeURIComponent(String(formTemplateGuid))}` +
      '?ts=' +
      new Date().getTime() +
      (raw ? '&raw=' + encodeURIComponent(String(raw)) : '')
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new FormTemplate(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Keys must be delimited by coma
   * @summary Get a list of forms by ids
   * @param body
   */
  async getForms(body?: ListOfIds): Promise<Array<Form>> {
    let _body = null
    _body = body

    const _url = this.host + `/form/byIds` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('POST', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all forms with given logicalUuid
   * @param logicalUuid
   */
  async getFormsByLogicalUuid(logicalUuid: string): Promise<Array<Form>> {
    let _body = null

    const _url = this.host + `/form/all/logicalUuid/${encodeURIComponent(String(logicalUuid))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Gets all forms by uniqueId
   * @param uniqueId
   */
  async getFormsByUniqueId(uniqueId: string): Promise<Array<Form>> {
    let _body = null

    const _url = this.host + `/form/all/uniqueId/${encodeURIComponent(String(uniqueId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    return XHR.sendCommand('GET', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified form.
   * @summary Modify a form
   * @param body
   */
  async modifyForm(body?: Form): Promise<Form> {
    let _body = null
    _body = body

    const _url = this.host + `/form` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new Form(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns the modified forms.
   * @summary Modify a batch of forms
   * @param body
   */
  async modifyForms(body?: Array<Form>): Promise<Array<Form>> {
    let _body = null
    _body = body

    const _url = this.host + `/form/batch` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((it) => new Form(it)))
      .catch((err) => this.handleError(err))
  }

  /**
   *
   * @summary Update a form template's layout
   * @param attachment
   * @param formTemplateId
   */
  async setTemplateAttachmentMulti(attachment: ArrayBuffer, formTemplateId: string): Promise<string> {
    let _body = null
    if (attachment && !_body) {
      const parts = Array.isArray(attachment) ? (attachment as any[]) : [attachment as ArrayBuffer]
      const _blob = new Blob(parts, { type: 'application/octet-stream' })
      _body = new FormData()
      _body.append('attachment', _blob)
    }

    const _url = this.host + `/form/template/${encodeURIComponent(String(formTemplateId))}/attachment/multipart` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'multipart/form-data'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => JSON.parse(JSON.stringify(doc.body)))
      .catch((err) => this.handleError(err))
  }

  /**
   * Returns an instance of created form template.
   * @summary Modify a form template with the current user
   * @param body
   * @param formTemplateId
   */
  async updateFormTemplate(formTemplateId: string, body?: FormTemplate): Promise<FormTemplate> {
    let _body = null
    _body = body

    const _url = this.host + `/form/template/${encodeURIComponent(String(formTemplateId))}` + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => new FormTemplate(doc.body as JSON))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareForms(request: BulkShareOrUpdateMetadataParams): Promise<EntityBulkShareResult<Form>[]> {
    const _url = this.host + '/form/bulkSharedMetadataUpdate' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new EntityBulkShareResult<Form>(x, Form)))
      .catch((err) => this.handleError(err))
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   */
  async bulkShareFormsMinimal(request: BulkShareOrUpdateMetadataParams): Promise<MinimalEntityBulkShareResult[]> {
    const _url = this.host + '/form/bulkSharedMetadataUpdateMinimal' + '?ts=' + new Date().getTime()
    let headers = await this.headers
    headers = headers.filter((h) => h.header !== 'Content-Type').concat(new XHR.Header('Content-Type', 'application/json'))
    return XHR.sendCommand('PUT', _url, headers, request, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => (doc.body as Array<JSON>).map((x) => new MinimalEntityBulkShareResult(x)))
      .catch((err) => this.handleError(err))
  }
}
