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

export class InvoicingCode {
  constructor(json: JSON | any) {
    Object.assign(this as InvoicingCode, json)
  }

  id?: string
  dateCode?: number
  logicalId?: string
  label?: string
  userId?: string
  contactId?: string
  serviceId?: string
  tarificationId?: string
  code?: string
  paymentType?: InvoicingCode.PaymentTypeEnum
  paid?: number
  totalAmount?: number
  reimbursement?: number
  patientIntervention?: number
  doctorSupplement?: number
  conventionAmount?: number
  vat?: number
  error?: string
  contract?: string
  contractDate?: number
  units?: number
  side?: number
  timeOfDay?: number
  eidReadingHour?: number
  eidReadingValue?: string
  override3rdPayerCode?: number
  override3rdPayerReason?: string
  transplantationCode?: number
  prescriberNorm?: number
  percentNorm?: number
  prescriberNihii?: string
  relatedCode?: string
  prescriptionDate?: number
  derogationMaxNumber?: number
  prescriberSsin?: string
  prescriberLastName?: string
  prescriberFirstName?: string
  prescriberCdHcParty?: string
  locationNihii?: string
  locationCdHcParty?: string
  canceled?: boolean
  accepted?: boolean
  pending?: boolean
  resent?: boolean
  archived?: boolean
  lost?: boolean
  insuranceJustification?: number
  cancelPatientInterventionReason?: number
  status?: number
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
export namespace InvoicingCode {
  export type PaymentTypeEnum = 'cash' | 'wired' | 'insurance' | 'creditcard' | 'debitcard' | 'paypal' | 'bitcoin' | 'other'
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
