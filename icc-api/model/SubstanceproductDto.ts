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
import { CodeDto } from "./CodeDto"

export class SubstanceproductDto {
  constructor(json: JSON | any) {
    Object.assign(this as SubstanceproductDto, json)
  }

  intendedcds?: Array<CodeDto>
  deliveredcds?: Array<CodeDto>
  intendedname?: string
  deliveredname?: any
}
