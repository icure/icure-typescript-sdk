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
import { CodeStubDto } from "./CodeStubDto"
import { DelegationDto } from "./DelegationDto"

export class DocumentDto {
  constructor(json: JSON | any) {
    Object.assign(this as DocumentDto, json)
  }

  id?: string
  rev?: string
  created?: number
  modified?: number
  author?: string
  responsible?: string
  medicalLocationId?: string
  tags?: Array<CodeStubDto>
  codes?: Array<CodeStubDto>
  endOfLife?: number
  deletionDate?: number
  attachment?: Array<string>
  documentLocation?: DocumentDto.DocumentLocationEnum
  documentType?: DocumentDto.DocumentTypeEnum
  documentStatus?: DocumentDto.DocumentStatusEnum
  externalUri?: string
  mainUti?: string
  name?: string
  otherUtis?: Array<string>
  storedICureDocumentId?: string
  attachmentId?: string
  secretForeignKeys?: Array<string>
  cryptedForeignKeys?: { [key: string]: Array<DelegationDto> }
  delegations?: { [key: string]: Array<DelegationDto> }
  encryptionKeys?: { [key: string]: Array<DelegationDto> }
  encryptedSelf?: string
}
export namespace DocumentDto {
  export type DocumentLocationEnum = "annex" | "body"
  export const DocumentLocationEnum = {
    Annex: "annex" as DocumentLocationEnum,
    Body: "body" as DocumentLocationEnum
  }
  export type DocumentTypeEnum =
    | "admission"
    | "alert"
    | "bvt_sample"
    | "clinicalpath"
    | "clinicalsummary"
    | "contactreport"
    | "quote"
    | "invoice"
    | "death"
    | "discharge"
    | "dischargereport"
    | "ebirth_baby_medicalform"
    | "ebirth_baby_notification"
    | "ebirth_mother_medicalform"
    | "ebirth_mother_notification"
    | "ecare_safe_consultation"
    | "epidemiology"
    | "intervention"
    | "labrequest"
    | "labresult"
    | "medicaladvisoragreement"
    | "medicationschemeelement"
    | "note"
    | "notification"
    | "pharmaceuticalprescription"
    | "prescription"
    | "productdelivery"
    | "quickdischargereport"
    | "radiationexposuremonitoring"
    | "referral"
    | "report"
    | "request"
    | "result"
    | "sumehr"
    | "telemonitoring"
    | "template"
    | "template_admin"
    | "treatmentsuspension"
    | "vaccination"
  export const DocumentTypeEnum = {
    Admission: "admission" as DocumentTypeEnum,
    Alert: "alert" as DocumentTypeEnum,
    BvtSample: "bvt_sample" as DocumentTypeEnum,
    Clinicalpath: "clinicalpath" as DocumentTypeEnum,
    Clinicalsummary: "clinicalsummary" as DocumentTypeEnum,
    Contactreport: "contactreport" as DocumentTypeEnum,
    Quote: "quote" as DocumentTypeEnum,
    Invoice: "invoice" as DocumentTypeEnum,
    Death: "death" as DocumentTypeEnum,
    Discharge: "discharge" as DocumentTypeEnum,
    Dischargereport: "dischargereport" as DocumentTypeEnum,
    EbirthBabyMedicalform: "ebirth_baby_medicalform" as DocumentTypeEnum,
    EbirthBabyNotification: "ebirth_baby_notification" as DocumentTypeEnum,
    EbirthMotherMedicalform: "ebirth_mother_medicalform" as DocumentTypeEnum,
    EbirthMotherNotification: "ebirth_mother_notification" as DocumentTypeEnum,
    EcareSafeConsultation: "ecare_safe_consultation" as DocumentTypeEnum,
    Epidemiology: "epidemiology" as DocumentTypeEnum,
    Intervention: "intervention" as DocumentTypeEnum,
    Labrequest: "labrequest" as DocumentTypeEnum,
    Labresult: "labresult" as DocumentTypeEnum,
    Medicaladvisoragreement: "medicaladvisoragreement" as DocumentTypeEnum,
    Medicationschemeelement: "medicationschemeelement" as DocumentTypeEnum,
    Note: "note" as DocumentTypeEnum,
    Notification: "notification" as DocumentTypeEnum,
    Pharmaceuticalprescription: "pharmaceuticalprescription" as DocumentTypeEnum,
    Prescription: "prescription" as DocumentTypeEnum,
    Productdelivery: "productdelivery" as DocumentTypeEnum,
    Quickdischargereport: "quickdischargereport" as DocumentTypeEnum,
    Radiationexposuremonitoring: "radiationexposuremonitoring" as DocumentTypeEnum,
    Referral: "referral" as DocumentTypeEnum,
    Report: "report" as DocumentTypeEnum,
    Request: "request" as DocumentTypeEnum,
    Result: "result" as DocumentTypeEnum,
    Sumehr: "sumehr" as DocumentTypeEnum,
    Telemonitoring: "telemonitoring" as DocumentTypeEnum,
    Template: "template" as DocumentTypeEnum,
    TemplateAdmin: "template_admin" as DocumentTypeEnum,
    Treatmentsuspension: "treatmentsuspension" as DocumentTypeEnum,
    Vaccination: "vaccination" as DocumentTypeEnum
  }
  export type DocumentStatusEnum =
    | "draft"
    | "finalized"
    | "pending_review"
    | "reviewed"
    | "pending_signature"
    | "signed"
    | "canceled"
    | "sent"
    | "delivered"
  export const DocumentStatusEnum = {
    Draft: "draft" as DocumentStatusEnum,
    Finalized: "finalized" as DocumentStatusEnum,
    PendingReview: "pending_review" as DocumentStatusEnum,
    Reviewed: "reviewed" as DocumentStatusEnum,
    PendingSignature: "pending_signature" as DocumentStatusEnum,
    Signed: "signed" as DocumentStatusEnum,
    Canceled: "canceled" as DocumentStatusEnum,
    Sent: "sent" as DocumentStatusEnum,
    Delivered: "delivered" as DocumentStatusEnum
  }
}
