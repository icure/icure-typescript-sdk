import { IccAgendaApi, IccAuthApi, IccEntityrefApi, IccGroupApi, IccInsuranceApi, IccPatientApi, IccPermissionApi } from '../icc-api'
import { IccUserXApi } from './icc-user-x-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccContactXApi } from './icc-contact-x-api'
import { IccInvoiceXApi } from './icc-invoice-x-api'
import { IccDocumentXApi } from './icc-document-x-api'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { IccFormXApi } from './icc-form-x-api'
import { IccHelementXApi } from './icc-helement-x-api'
import { IccClassificationXApi } from './icc-classification-x-api'
import { IccCalendarItemXApi } from './icc-calendar-item-x-api'
import { IccPatientXApi } from './icc-patient-x-api'
import { IccMessageXApi } from './icc-message-x-api'
import { IccReceiptXApi } from './icc-receipt-x-api'
import { IccAccesslogXApi } from './icc-accesslog-x-api'
import { IccTimeTableXApi } from './icc-time-table-x-api'
import { IccDeviceApi } from '../icc-api/api/IccDeviceApi'
import { IccCodeXApi } from './icc-code-x-api'
import {IccMaintenanceTaskXApi} from "./icc-maintenance-task-x-api"

export * from './icc-accesslog-x-api'
export * from './icc-bekmehr-x-api'
export * from './icc-calendar-item-x-api'
export * from './icc-classification-x-api'
export * from './icc-code-x-api'
export * from './icc-contact-x-api'
export * from './icc-crypto-x-api'
export * from './icc-doctemplate-x-api'
export * from './icc-document-x-api'
export * from './icc-form-x-api'
export * from './icc-hcparty-x-api'
export * from './icc-helement-x-api'
export * from './icc-invoice-x-api'
export * from './icc-message-x-api'
export * from './icc-patient-x-api'
export * from './icc-user-x-api'
export * from './icc-time-table-x-api'
export * from './icc-receipt-x-api'
export { utils, UtilsClass } from './crypto/utils'
export * from './utils'

export const apiHeaders = function (username: string, password: string) {
  return {
    Authorization: `Basic ${
      typeof btoa !== 'undefined' ? btoa(`${username}:${password}`) : Buffer.from(`${username}:${password}`).toString('base64')
    }`,
  }
}

export const Api = function (
  host: string,
  username: string,
  password: string,
  crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto),
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
    ? window.fetch
    : typeof self !== 'undefined'
    ? self.fetch
    : fetch
) {
  const headers = apiHeaders(username, password)
  const authApi = new IccAuthApi(host, headers, fetchImpl)
  const codeApi = new IccCodeXApi(host, headers, fetchImpl)
  const entityReferenceApi = new IccEntityrefApi(host, headers, fetchImpl)
  const userApi = new IccUserXApi(host, headers, fetchImpl)
  const permissionApi = new IccPermissionApi(host, headers, fetchImpl)
  const healthcarePartyApi = new IccHcpartyXApi(host, headers, fetchImpl)
  const deviceApi = new IccDeviceApi(host, headers, fetchImpl)
  const cryptoApi = new IccCryptoXApi(host, headers, healthcarePartyApi, new IccPatientApi(host, headers, fetchImpl), deviceApi, crypto)
  const accessLogApi = new IccAccesslogXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const agendaApi = new IccAgendaApi(host, headers, fetchImpl)
  const contactApi = new IccContactXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const formApi = new IccFormXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const groupApi = new IccGroupApi(host, headers)
  const invoiceApi = new IccInvoiceXApi(host, headers, cryptoApi, entityReferenceApi, userApi, fetchImpl)
  const insuranceApi = new IccInsuranceApi(host, headers, fetchImpl)
  const documentApi = new IccDocumentXApi(host, headers, cryptoApi, authApi, userApi, fetchImpl)
  const healthcareElementApi = new IccHelementXApi(host, headers, cryptoApi, userApi, [], fetchImpl)
  const classificationApi = new IccClassificationXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const calendarItemApi = new IccCalendarItemXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const receiptApi = new IccReceiptXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const timetableApi = new IccTimeTableXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const patientApi = new IccPatientXApi(
    host,
    headers,
    cryptoApi,
    contactApi,
    formApi,
    healthcareElementApi,
    invoiceApi,
    documentApi,
    healthcarePartyApi,
    classificationApi,
    userApi,
    calendarItemApi,
    ['note'],
    fetchImpl
  )
  const messageApi = new IccMessageXApi(host, headers, cryptoApi, userApi, fetchImpl)
  const maintenanceTaskApi = new IccMaintenanceTaskXApi(host, headers, cryptoApi, userApi, healthcarePartyApi, ['properties'], fetchImpl)

  return {
    cryptoApi,
    authApi,
    codeApi,
    userApi,
    permissionApi,
    patientApi,
    healthcarePartyApi,
    deviceApi,
    accessLogApi,
    contactApi,
    healthcareElementApi,
    documentApi,
    formApi,
    invoiceApi,
    insuranceApi,
    messageApi,
    entityReferenceApi,
    receiptApi,
    agendaApi,
    calendarItemApi,
    classificationApi,
    timetableApi,
    groupApi,
    maintenanceTaskApi
  }
}
