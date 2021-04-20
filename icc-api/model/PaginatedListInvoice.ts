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
import { Invoice } from './Invoice'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListInvoice {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListInvoice, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Invoice>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
