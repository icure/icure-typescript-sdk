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
import { Amp } from './Amp'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListAmp {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListAmp, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Amp>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
