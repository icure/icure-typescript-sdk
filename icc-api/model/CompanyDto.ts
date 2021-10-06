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

import { decodeBase64 } from "./ModelHelper"

export class CompanyDto {
  constructor(json: JSON | any) {
    Object.assign(this as CompanyDto, json)
  }

  from?: number
  to?: number
  authorisationNr?: string
  vatNr?: { [key: string]: string }
  europeanNr?: string
  denomination?: string
  legalForm?: string
  building?: string
  streetName?: string
  streetNum?: string
  postbox?: string
  postcode?: string
  city?: string
  countryCode?: string
  phone?: string
  language?: string
  website?: string
}
