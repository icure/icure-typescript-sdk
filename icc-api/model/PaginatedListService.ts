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
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Service } from './Service'

export class PaginatedListService {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListService, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Service>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
