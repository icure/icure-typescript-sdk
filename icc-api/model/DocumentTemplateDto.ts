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
import { DocumentGroupDto } from "./DocumentGroupDto"

export class DocumentTemplateDto {
  constructor(json: JSON | any) {
    Object.assign(this as DocumentTemplateDto, json)
  }

  id?: string
  rev?: string
  deletionDate?: number
  modified?: number
  created?: number
  owner?: string
  guid?: string
  attachmentId?: string
  documentType?: DocumentTemplateDto.DocumentTypeEnum
  mainUti?: string
  group?: DocumentGroupDto
  name?: string
  descr?: string
  disabled?: string
  specialty?: CodeDto
}
export namespace DocumentTemplateDto {
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
}
