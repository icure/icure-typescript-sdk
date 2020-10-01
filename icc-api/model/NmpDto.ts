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
import { SamTextDto } from "./SamTextDto"

import { decodeBase64 } from "./ModelHelper"

export class NmpDto {
  constructor(json: JSON | any) {
    Object.assign(this as NmpDto, json)
  }

  id?: string
  rev?: string
  deletionDate?: number
  from?: number
  to?: number
  code?: string
  category?: string
  commercialStatus?: string
  name?: SamTextDto
  producer?: SamTextDto
  distributor?: SamTextDto
}
