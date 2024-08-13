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
import { HealthElement } from './HealthElement'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListHealthElement {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListHealthElement, {...json, rows: json.rows?.map((r: any) => new HealthElement(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<HealthElement>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
