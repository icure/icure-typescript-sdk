/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { CareTeamMember } from './CareTeamMember'
import { CodeStub } from './CodeStub'
import { Delegation } from './Delegation'
import { Episode } from './Episode'
import { Identifier } from './Identifier'
import { PlanOfAction } from './PlanOfAction'
import { Annotation } from './Annotation'
import { SecurityMetadata } from './SecurityMetadata'
import { EntityWithDelegationTypeName } from '../../icc-x-api/utils/EntityWithDelegationTypeName'

/**
 * This entity is a root level object. It represents a healthcare element. It is serialized in JSON and saved in the underlying CouchDB database.
 */
export class HealthElement {
  constructor(json: JSON | any) {
    Object.assign(this as HealthElement, json)
  }

  /**
   * The Id of the healthcare element. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  identifiers?: Array<Identifier>
  /**
   * The revision of the healthcare element in the database, used for conflict management / optimistic locking.
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
   * The logical id of the healthcare element, used to link together different versions of the same healthcare element. We encourage using either a v4 UUID or a HL7 Id.
   */
  healthElementId?: string
  /**
   * The date (unix epoch in ms) when the healthcare element is noted to have started and also closes on the same date
   */
  valueDate?: number
  /**
   * The date (unix epoch in ms) of the start of the healthcare element.
   */
  openingDate?: number
  /**
   * The date (unix epoch in ms) marking the end of the healthcare element.
   */
  closingDate?: number
  /**
   * Description of the healthcare element.
   */
  descr?: string
  /**
   * A text note (can be confidential, encrypted by default).
   * @deprecated Use notes instead
   */
  note?: string

  /**
   * Localized text notes (can be confidential, encrypted by default).
   */
  notes?: Annotation[]

  /**
   * If the healthcare element is relevant or not (Set relevant by default).
   */
  relevant?: boolean
  /**
   * Id of the opening contact when the healthcare element was created.
   */
  idOpeningContact?: string
  /**
   * Id of the closing contact for the healthcare element.
   */
  idClosingContact?: string
  /**
   * Id of the service when a service is used to create a healthcare element.
   */
  idService?: string
  /**
   * bit 0: active/inactive, bit 1: relevant/irrelevant, bit 2 : present/absent, ex: 0 = active,relevant and present
   */
  status?: number
  /**
   * Left or Right dominance/preference.
   */
  laterality?: HealthElement.LateralityEnum
  /**
   * List of healthcare approaches.
   */
  plansOfAction?: Array<PlanOfAction>
  /**
   * List of episodes of occurrences of the healthcare element.
   */
  episodes?: Array<Episode>
  /**
   * List of care team members assigned for the healthcare element.
   */
  careTeam?: Array<CareTeamMember>
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
  securityMetadata?: SecurityMetadata
  readonly _type?: EntityWithDelegationTypeName = 'HealthElement'
}
export namespace HealthElement {
  export type LateralityEnum = 'left' | 'right'
  export const LateralityEnum = {
    Left: 'left' as LateralityEnum,
    Right: 'right' as LateralityEnum,
  }
}
