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
import { NumeratorRangeDto } from "./NumeratorRangeDto"
import { QuantityDto } from "./QuantityDto"

export class StrengthRangeDto {
  constructor(json: JSON | any) {
    Object.assign(this as StrengthRangeDto, json)
  }

  numeratorRange?: NumeratorRangeDto
  denominator?: QuantityDto
}
