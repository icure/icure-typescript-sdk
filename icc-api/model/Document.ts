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
import { CodeStub } from './CodeStub'
import { Delegation } from './Delegation'

/**
 * This entity is a root level object. It represents a Document. It is serialized in JSON and saved in the underlying CouchDB database.
 */
import { b64_2ab } from './ModelHelper'
export class Document {
  constructor(json: JSON | any) {
    Object.assign(
      this as Document,
      json,
      json.encryptedAttachment ? { encryptedAttachment: b64_2ab(json.encryptedAttachment) } : {},
      json.decryptedAttachment ? { decryptedAttachment: b64_2ab(json.decryptedAttachment) } : {}
    )
  }

  /**
   * The Id of the document. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * The revision of the document in the database, used for conflict management / optimistic locking.
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
   * The id of the User that has created this entity, will be filled automatically if missing. Not enforced by the application server.
   */
  author?: string
  /**
   * The id of the HealthcareParty that is responsible for this entity, will be filled automatically if missing. Not enforced by the application server.
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
   * Reference in object store
   */
  objectStoreReference?: string
  /**
   * Location of the document
   */
  documentLocation?: Document.DocumentLocationEnum
  /**
   * The type of document, ex: admission, clinical path, document report,invoice, etc.
   */
  documentType?: Document.DocumentTypeEnum
  /**
   * The status of the development of the document. Ex: Draft, finalized, reviewed, signed, etc.
   */
  documentStatus?: Document.DocumentStatusEnum
  /**
   * When the document is stored in an external repository, this is the uri of the document in that repository
   */
  externalUri?: string
  /**
   * The main Uniform Type Identifier of the document (https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/understanding_utis/understand_utis_conc/understand_utis_conc.html#//apple_ref/doc/uid/TP40001319-CH202-CHDHIJDE)
   */
  mainUti?: string
  /**
   * Name of the document
   */
  name?: string
  /**
   * The document version
   */
  version?: string
  /**
   * Extra Uniform Type Identifiers
   */
  otherUtis?: Array<string>
  /**
   * The ICureDocument (Form, Contact, ...) that has been used to generate the document
   */
  storedICureDocumentId?: string
  /**
   * A unique external id (from another external source).
   */
  externalUuid?: string
  /**
   * Size of the document file
   */
  size?: number
  /**
   * Hashed version of the document
   */
  hash?: string
  /**
   * Id of the contact during which the document was created
   */
  openingContactId?: string
  /**
   * Id of attachment to this document
   */
  attachmentId?: string
  encryptedAttachment?: ArrayBuffer
  decryptedAttachment?: ArrayBuffer
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
export namespace Document {
  export type DocumentLocationEnum = 'annex' | 'body'
  export const DocumentLocationEnum = {
    Annex: 'annex' as DocumentLocationEnum,
    Body: 'body' as DocumentLocationEnum,
  }
  export type DocumentTypeEnum =
    | 'admission'
    | 'alert'
    | 'bvt_sample'
    | 'clinicalpath'
    | 'clinicalsummary'
    | 'contactreport'
    | 'quote'
    | 'invoice'
    | 'death'
    | 'discharge'
    | 'dischargereport'
    | 'ebirth_baby_medicalform'
    | 'ebirth_baby_notification'
    | 'ebirth_mother_medicalform'
    | 'ebirth_mother_notification'
    | 'ecare_safe_consultation'
    | 'epidemiology'
    | 'intervention'
    | 'labrequest'
    | 'labresult'
    | 'medicaladvisoragreement'
    | 'medicationschemeelement'
    | 'note'
    | 'notification'
    | 'pharmaceuticalprescription'
    | 'prescription'
    | 'productdelivery'
    | 'quickdischargereport'
    | 'radiationexposuremonitoring'
    | 'referral'
    | 'report'
    | 'request'
    | 'result'
    | 'sumehr'
    | 'telemonitoring'
    | 'template'
    | 'template_admin'
    | 'treatmentsuspension'
    | 'vaccination'
  export const DocumentTypeEnum = {
    Admission: 'admission' as DocumentTypeEnum,
    Alert: 'alert' as DocumentTypeEnum,
    BvtSample: 'bvt_sample' as DocumentTypeEnum,
    Clinicalpath: 'clinicalpath' as DocumentTypeEnum,
    Clinicalsummary: 'clinicalsummary' as DocumentTypeEnum,
    Contactreport: 'contactreport' as DocumentTypeEnum,
    Quote: 'quote' as DocumentTypeEnum,
    Invoice: 'invoice' as DocumentTypeEnum,
    Death: 'death' as DocumentTypeEnum,
    Discharge: 'discharge' as DocumentTypeEnum,
    Dischargereport: 'dischargereport' as DocumentTypeEnum,
    EbirthBabyMedicalform: 'ebirth_baby_medicalform' as DocumentTypeEnum,
    EbirthBabyNotification: 'ebirth_baby_notification' as DocumentTypeEnum,
    EbirthMotherMedicalform: 'ebirth_mother_medicalform' as DocumentTypeEnum,
    EbirthMotherNotification: 'ebirth_mother_notification' as DocumentTypeEnum,
    EcareSafeConsultation: 'ecare_safe_consultation' as DocumentTypeEnum,
    Epidemiology: 'epidemiology' as DocumentTypeEnum,
    Intervention: 'intervention' as DocumentTypeEnum,
    Labrequest: 'labrequest' as DocumentTypeEnum,
    Labresult: 'labresult' as DocumentTypeEnum,
    Medicaladvisoragreement: 'medicaladvisoragreement' as DocumentTypeEnum,
    Medicationschemeelement: 'medicationschemeelement' as DocumentTypeEnum,
    Note: 'note' as DocumentTypeEnum,
    Notification: 'notification' as DocumentTypeEnum,
    Pharmaceuticalprescription: 'pharmaceuticalprescription' as DocumentTypeEnum,
    Prescription: 'prescription' as DocumentTypeEnum,
    Productdelivery: 'productdelivery' as DocumentTypeEnum,
    Quickdischargereport: 'quickdischargereport' as DocumentTypeEnum,
    Radiationexposuremonitoring: 'radiationexposuremonitoring' as DocumentTypeEnum,
    Referral: 'referral' as DocumentTypeEnum,
    Report: 'report' as DocumentTypeEnum,
    Request: 'request' as DocumentTypeEnum,
    Result: 'result' as DocumentTypeEnum,
    Sumehr: 'sumehr' as DocumentTypeEnum,
    Telemonitoring: 'telemonitoring' as DocumentTypeEnum,
    Template: 'template' as DocumentTypeEnum,
    TemplateAdmin: 'template_admin' as DocumentTypeEnum,
    Treatmentsuspension: 'treatmentsuspension' as DocumentTypeEnum,
    Vaccination: 'vaccination' as DocumentTypeEnum,
  }
  export type DocumentStatusEnum =
    | 'draft'
    | 'finalized'
    | 'pending_review'
    | 'reviewed'
    | 'pending_signature'
    | 'signed'
    | 'canceled'
    | 'sent'
    | 'delivered'
  export const DocumentStatusEnum = {
    Draft: 'draft' as DocumentStatusEnum,
    Finalized: 'finalized' as DocumentStatusEnum,
    PendingReview: 'pending_review' as DocumentStatusEnum,
    Reviewed: 'reviewed' as DocumentStatusEnum,
    PendingSignature: 'pending_signature' as DocumentStatusEnum,
    Signed: 'signed' as DocumentStatusEnum,
    Canceled: 'canceled' as DocumentStatusEnum,
    Sent: 'sent' as DocumentStatusEnum,
    Delivered: 'delivered' as DocumentStatusEnum,
  }
}
