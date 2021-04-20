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

export class Payment {
  constructor(json: JSON | any) {
    Object.assign(this as Payment, json)
  }

  paymentDate?: number
  paymentType?: Payment.PaymentTypeEnum
  paid?: number
}
export namespace Payment {
  export type PaymentTypeEnum =
    | 'cash'
    | 'wired'
    | 'insurance'
    | 'creditcard'
    | 'debitcard'
    | 'paypal'
    | 'bitcoin'
    | 'other'
  export const PaymentTypeEnum = {
    Cash: 'cash' as PaymentTypeEnum,
    Wired: 'wired' as PaymentTypeEnum,
    Insurance: 'insurance' as PaymentTypeEnum,
    Creditcard: 'creditcard' as PaymentTypeEnum,
    Debitcard: 'debitcard' as PaymentTypeEnum,
    Paypal: 'paypal' as PaymentTypeEnum,
    Bitcoin: 'bitcoin' as PaymentTypeEnum,
    Other: 'other' as PaymentTypeEnum,
  }
}
