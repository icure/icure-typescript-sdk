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
import { Invoice } from './Invoice'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListInvoice {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListInvoice, {...json, rows: json.rows?.map((r: any) => new Invoice(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Invoice>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
