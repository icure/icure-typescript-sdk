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

import { decodeBase64 } from "./ModelHelper"

export class AppointmentImportDto {
  constructor(json: JSON | any) {
    Object.assign(this as AppointmentImportDto, json)
  }

  comments?: string
  externalCustomerId?: string
  customerId?: string
  customerComments?: string
  title?: string
  endTime?: number
  startTime?: number
  type?: string
  appointmentTypeId?: string
  ownerRef?: string
  customerName?: string
  customerFirstname?: string
  customerEmail?: string
  city?: string
  postcode?: string
  street?: string
  sex?: string
  externalId?: string
  customerBirthDate?: number
  customerGsm?: string
  customerFixPhone?: string
}
