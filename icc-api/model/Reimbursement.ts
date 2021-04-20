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
import { Copayment } from './Copayment'
import { Pricing } from './Pricing'
import { ReimbursementCriterion } from './ReimbursementCriterion'

export class Reimbursement {
  constructor(json: JSON | any) {
    Object.assign(this as Reimbursement, json)
  }

  from?: number
  to?: number
  deliveryEnvironment?: Reimbursement.DeliveryEnvironmentEnum
  code?: string
  codeType?: Reimbursement.CodeTypeEnum
  multiple?: Reimbursement.MultipleEnum
  temporary?: boolean
  reference?: boolean
  legalReferencePath?: string
  flatRateSystem?: boolean
  reimbursementBasePrice?: number
  referenceBasePrice?: number
  copaymentSupplement?: number
  pricingUnit?: Pricing
  pricingSlice?: Pricing
  reimbursementCriterion?: ReimbursementCriterion
  copayments?: Array<Copayment>
}
export namespace Reimbursement {
  export type DeliveryEnvironmentEnum = 'P' | 'A' | 'H' | 'R'
  export const DeliveryEnvironmentEnum = {
    P: 'P' as DeliveryEnvironmentEnum,
    A: 'A' as DeliveryEnvironmentEnum,
    H: 'H' as DeliveryEnvironmentEnum,
    R: 'R' as DeliveryEnvironmentEnum,
  }
  export type CodeTypeEnum = 'CNK' | 'PSEUDO'
  export const CodeTypeEnum = {
    CNK: 'CNK' as CodeTypeEnum,
    PSEUDO: 'PSEUDO' as CodeTypeEnum,
  }
  export type MultipleEnum = 'M' | 'V'
  export const MultipleEnum = {
    M: 'M' as MultipleEnum,
    V: 'V' as MultipleEnum,
  }
}
