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
import { SamTextDto } from "./SamTextDto"

import { decodeBase64 } from "./ModelHelper"

export class DeviceTypeDto {
  constructor(json: JSON | any) {
    Object.assign(this as DeviceTypeDto, json)
  }

  code?: string
  name?: SamTextDto
  edqmCode?: string
  edqmDefinition?: string
}
