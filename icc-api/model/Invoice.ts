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
import { CodeStub } from "./CodeStub"
import { Delegation } from "./Delegation"
import { IdentityDocumentReader } from "./IdentityDocumentReader"
import { InvoicingCode } from "./InvoicingCode"
import { Payment } from "./Payment"

/**
 * This entity is a root level object. It represents an Invoice. It is serialized in JSON and saved in the underlying iCure CouchDB database.
 */
export class Invoice {
  constructor(json: JSON | any) {
    Object.assign(this as Invoice, json)
  }

  /**
   * The Id of the Invoice. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * The revision of the invoice in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * The timestamp (unix epoch in ms) of creation of this entity, will be filled automatically if missing. Not enforced by the application server.
   */
  created?: number
  /**
   * The date (unix epoch in ms) of the latest modification of this entity, will be filled automatically if missing. Not enforced by the application server.
   */
  modified?: number
  /**
   * The id of the User that has created this form, will be filled automatically if missing. Not enforced by the application server.
   */
  author?: string
  /**
   * The id of the HealthcareParty that is responsible for this form, will be filled automatically if missing. Not enforced by the application server.
   */
  responsible?: string
  /**
   * The id of the medical location where this entity was created.
   */
  medicalLocationId?: string
  /**
   * A tag is an item from a codification system that qualifies an entity as being member of a certain class, whatever the value it might have taken. If the tag qualifies the content of a field, it means that whatever the content of the field, the tag will always apply. For example, the label of a field is qualified using a tag. LOINC is a codification system typically used for tags.
   */
  tags?: Array<CodeStub>
  /**
   * A code is an item from a codification system that qualifies the content of this entity. SNOMED-CT, ICPC-2 or ICD-10 codifications systems can be used for codes
   */
  codes?: Array<CodeStub>
  /**
   * Soft delete (unix epoch in ms) timestamp of the object.
   */
  endOfLife?: number
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  /**
   * The timestamp (unix epoch in ms) when the invoice was drafted, will be filled automatically if missing. Not enforced by the application server.
   */
  invoiceDate?: number
  /**
   * The timestamp (unix epoch in ms) when the invoice was sent, will be filled automatically if missing. Not enforced by the application server.
   */
  sentDate?: number
  /**
   * The timestamp (unix epoch in ms) when the invoice is printed, will be filled automatically if missing. Not enforced by the application server.
   */
  printedDate?: number
  invoicingCodes?: Array<InvoicingCode>
  receipts?: { [key: string]: string }
  /**
   * The type of user that receives the invoice, a patient or a healthcare party
   */
  recipientType?: string
  /**
   * Id of the recipient of the invoice. For healthcare party and insurance, patient link happens through secretForeignKeys
   */
  recipientId?: string
  invoiceReference?: string
  thirdPartyReference?: string
  thirdPartyPaymentJustification?: string
  thirdPartyPaymentReason?: string
  reason?: string
  /**
   * The format the invoice should follow based on the recipient which could be a patient, mutual fund or paying agency such as the CPAS
   */
  invoiceType?: Invoice.InvoiceTypeEnum
  /**
   * Medium of the invoice: CD ROM, Email, paper, etc.
   */
  sentMediumType?: Invoice.SentMediumTypeEnum
  interventionType?: Invoice.InterventionTypeEnum
  groupId?: string
  /**
   * Type of payment, ex: cash, wired, insurance, debit card, etc.
   */
  paymentType?: Invoice.PaymentTypeEnum
  paid?: number
  payments?: Array<Payment>
  gnotionNihii?: string
  gnotionSsin?: string
  gnotionLastName?: string
  gnotionFirstName?: string
  gnotionCdHcParty?: string
  invoicePeriod?: number
  careProviderType?: string
  internshipNihii?: string
  internshipSsin?: string
  internshipLastName?: string
  internshipFirstName?: string
  internshipCdHcParty?: string
  internshipCbe?: string
  supervisorNihii?: string
  supervisorSsin?: string
  supervisorLastName?: string
  supervisorFirstName?: string
  supervisorCdHcParty?: string
  supervisorCbe?: string
  error?: string
  encounterLocationName?: string
  encounterLocationNihii?: string
  encounterLocationNorm?: number
  longDelayJustification?: number
  correctiveInvoiceId?: string
  correctedInvoiceId?: string
  creditNote?: boolean
  creditNoteRelatedInvoiceId?: string
  idDocument?: IdentityDocumentReader
  cancelReason?: string
  cancelDate?: number
  options?: { [key: string]: string }
  /**
   * The secretForeignKeys are filled at the to many end of a one to many relationship (for example inside Contact for the Patient -> Contacts relationship). Used when we want to find all contacts for a specific patient. These keys are in clear. You can have several to partition the medical document space.
   */
  secretForeignKeys?: Array<string>
  /**
   * The secretForeignKeys are filled at the to many end of a one to many relationship (for example inside Contact for the Patient -> Contacts relationship). Used when we want to find the patient for a specific contact. These keys are the encrypted id (using the hcParty key for the delegate) that can be found in clear inside the patient. ids encrypted using the hcParty keys.
   */
  cryptedForeignKeys?: { [key: string]: Array<Delegation> }
  /**
   * When a document is created, the responsible generates a cryptographically random master key (never to be used for something else than referencing from other entities). He/she encrypts it using his own AES exchange key and stores it as a delegation. The responsible is thus always in the delegations as well
   */
  delegations?: { [key: string]: Array<Delegation> }
  /**
   * When a document needs to be encrypted, the responsible generates a cryptographically random master key (different from the delegation key, never to appear in clear anywhere in the db. He/she encrypts it using his own AES exchange key and stores it as a delegation
   */
  encryptionKeys?: { [key: string]: Array<Delegation> }
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
export namespace Invoice {
  export type InvoiceTypeEnum =
    | "patient"
    | "mutualfund"
    | "payingagency"
    | "insurance"
    | "efact"
    | "other"
  export const InvoiceTypeEnum = {
    Patient: "patient" as InvoiceTypeEnum,
    Mutualfund: "mutualfund" as InvoiceTypeEnum,
    Payingagency: "payingagency" as InvoiceTypeEnum,
    Insurance: "insurance" as InvoiceTypeEnum,
    Efact: "efact" as InvoiceTypeEnum,
    Other: "other" as InvoiceTypeEnum
  }
  export type SentMediumTypeEnum = "cdrom" | "eattest" | "efact" | "email" | "mediprima" | "paper"
  export const SentMediumTypeEnum = {
    Cdrom: "cdrom" as SentMediumTypeEnum,
    Eattest: "eattest" as SentMediumTypeEnum,
    Efact: "efact" as SentMediumTypeEnum,
    Email: "email" as SentMediumTypeEnum,
    Mediprima: "mediprima" as SentMediumTypeEnum,
    Paper: "paper" as SentMediumTypeEnum
  }
  export type InterventionTypeEnum = "total" | "userfees"
  export const InterventionTypeEnum = {
    Total: "total" as InterventionTypeEnum,
    Userfees: "userfees" as InterventionTypeEnum
  }
  export type PaymentTypeEnum =
    | "cash"
    | "wired"
    | "insurance"
    | "creditcard"
    | "debitcard"
    | "paypal"
    | "bitcoin"
    | "other"
  export const PaymentTypeEnum = {
    Cash: "cash" as PaymentTypeEnum,
    Wired: "wired" as PaymentTypeEnum,
    Insurance: "insurance" as PaymentTypeEnum,
    Creditcard: "creditcard" as PaymentTypeEnum,
    Debitcard: "debitcard" as PaymentTypeEnum,
    Paypal: "paypal" as PaymentTypeEnum,
    Bitcoin: "bitcoin" as PaymentTypeEnum,
    Other: "other" as PaymentTypeEnum
  }
}
