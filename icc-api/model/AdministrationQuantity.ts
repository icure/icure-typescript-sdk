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
import { CodeStub } from './CodeStub'

export class AdministrationQuantity {
  constructor(json: JSON | any) {
    Object.assign(this as AdministrationQuantity, json)
  }

  quantity?: number
  administrationUnit?: CodeStub
  unit?: string
}
