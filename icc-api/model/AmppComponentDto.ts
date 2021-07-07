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
import { DeviceTypeDto } from "./DeviceTypeDto"
import { PackagingTypeDto } from "./PackagingTypeDto"

import { decodeBase64 } from "./ModelHelper"

export class AmppComponentDto {
  constructor(json: JSON | any) {
    Object.assign(this as AmppComponentDto, json)
  }

  from?: number
  to?: number
  contentType?: AmppComponentDto.ContentTypeEnum
  contentMultiplier?: number
  packSpecification?: string
  deviceType?: DeviceTypeDto
  packagingType?: PackagingTypeDto
}
export namespace AmppComponentDto {
  export type ContentTypeEnum = "ACTIVE_COMPONENT" | "SOLVENT" | "DEVICE" | "EXCIPIENT"
  export const ContentTypeEnum = {
    ACTIVECOMPONENT: "ACTIVE_COMPONENT" as ContentTypeEnum,
    SOLVENT: "SOLVENT" as ContentTypeEnum,
    DEVICE: "DEVICE" as ContentTypeEnum,
    EXCIPIENT: "EXCIPIENT" as ContentTypeEnum,
  }
}
