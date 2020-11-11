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
import { CopaymentDto } from "./CopaymentDto"
import { PricingDto } from "./PricingDto"
import { ReimbursementCriterionDto } from "./ReimbursementCriterionDto"

import { decodeBase64 } from "./ModelHelper"

export class ReimbursementDto {
  constructor(json: JSON | any) {
    Object.assign(this as ReimbursementDto, json)
  }

  from?: number
  to?: number
  deliveryEnvironment?: ReimbursementDto.DeliveryEnvironmentEnum
  code?: string
  codeType?: ReimbursementDto.CodeTypeEnum
  multiple?: ReimbursementDto.MultipleEnum
  temporary?: boolean
  reference?: boolean
  legalReferencePath?: string
  flatRateSystem?: boolean
  reimbursementBasePrice?: number
  referenceBasePrice?: number
  copaymentSupplement?: number
  pricingUnit?: PricingDto
  pricingSlice?: PricingDto
  reimbursementCriterion?: ReimbursementCriterionDto
  copayments?: Array<CopaymentDto>
}
export namespace ReimbursementDto {
  export type DeliveryEnvironmentEnum = "P" | "A" | "H" | "R"
  export const DeliveryEnvironmentEnum = {
    P: "P" as DeliveryEnvironmentEnum,
    A: "A" as DeliveryEnvironmentEnum,
    H: "H" as DeliveryEnvironmentEnum,
    R: "R" as DeliveryEnvironmentEnum
  }
  export type CodeTypeEnum = "CNK" | "PSEUDO"
  export const CodeTypeEnum = {
    CNK: "CNK" as CodeTypeEnum,
    PSEUDO: "PSEUDO" as CodeTypeEnum
  }
  export type MultipleEnum = "M" | "V"
  export const MultipleEnum = {
    M: "M" as MultipleEnum,
    V: "V" as MultipleEnum
  }
}
