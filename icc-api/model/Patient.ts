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
import { Address } from './Address'
import { CodeStub } from './CodeStub'
import { Delegation } from './Delegation'
import { EmploymentInfo } from './EmploymentInfo'
import { FinancialInstitutionInformation } from './FinancialInstitutionInformation'
import { Identifier } from './Identifier'
import { Insurability } from './Insurability'
import { MedicalHouseContract } from './MedicalHouseContract'
import { Partnership } from './Partnership'
import { PatientHealthCareParty } from './PatientHealthCareParty'
import { PersonName } from './PersonName'
import { PropertyStub } from './PropertyStub'
import { SchoolingInfo } from './SchoolingInfo'
import { Annotation } from './Annotation'

/**
 * This entity is a root level object. It represents a patient It is serialized in JSON and saved in the underlying icure-patient CouchDB database.
 */
import { b64_2ab } from './ModelHelper'
import { SecurityMetadata } from './SecurityMetadata'
import { EntityWithDelegationTypeName } from '../../icc-x-api/utils/EntityWithDelegationTypeName'
export class Patient {
  constructor(json: JSON | any) {
    let pictureData: { picture?: ArrayBuffer } = {}
    if (!!json.picture) {
      if (typeof json.picture === 'string') {
        pictureData.picture = b64_2ab(json.picture)
      } else if (json.picture instanceof ArrayBuffer || ArrayBuffer.isView(json.picture)) {
        pictureData.picture = json.picture
      } else {
        throw new Error(`Invalid type for picture: ${typeof json.picture}`)
      }
    }
    Object.assign(this as Patient, json, pictureData)
  }

  /**
   * the Id of the patient. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * the revision of the patient in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  identifier?: Array<Identifier>
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
   * the firstname (name) of the patient.
   */
  firstName?: string
  /**
   * the lastname (surname) of the patient. This is the official lastname that should be used for official administrative purposes.
   */
  lastName?: string
  /**
   * the list of all names of the patient, also containing the official full name information. Ordered by preference of use. First element is therefore the official name used for the patient in the application
   */
  names?: Array<PersonName>
  /**
   * the name of the company this patient is member of.
   */
  companyName?: string
  /**
   * the list of languages spoken by the patient ordered by fluency (alpha-2 code http://www.loc.gov/standards/iso639-2/ascii_8bits.html).
   */
  languages?: Array<string>
  /**
   * the list of addresses (with address type).
   */
  addresses?: Array<Address>
  /**
   * Mr., Ms., Pr., Dr. ...
   */
  civility?: string
  /**
   * the gender of the patient: male, female, indeterminate, changed, changedToMale, changedToFemale, unknown
   */
  gender?: Patient.GenderEnum
  /**
   * the birth sex of the patient: male, female, indeterminate, unknown
   */
  birthSex?: Patient.BirthSexEnum
  /**
   * The id of the patient this patient has been merged with.
   */
  mergeToPatientId?: string
  /**
   * The ids of the patients that have been merged inside this patient.
   */
  mergedIds?: Array<string>
  /**
   * An alias of the person, nickname, ...
   */
  alias?: string
  /**
   * Is the patient active (boolean).
   */
  active?: boolean
  /**
   * When not active, the reason for deactivation.
   */
  deactivationReason?: Patient.DeactivationReasonEnum
  /**
   * Deactivation date of the patient
   */
  deactivationDate?: number
  /**
   * Social security inscription number.
   */
  ssin?: string
  /**
   * Lastname at birth (can be different of the current name), depending on the country, must be used to design the patient .
   */
  maidenName?: string
  /**
   * Lastname of the spouse for a married woman, depending on the country, can be used to design the patient.
   */
  spouseName?: string
  /**
   * Lastname of the partner, should not be used to design the patient.
   */
  partnerName?: string
  /**
   * any of `single`, `in_couple`, `married`, `separated`, `divorced`, `divorcing`, `widowed`, `widower`, `complicated`, `unknown`, `contract`, `other`.
   */
  personalStatus?: Patient.PersonalStatusEnum
  /**
   * The birthdate encoded as a fuzzy date on 8 positions (YYYYMMDD) MM and/or DD can be set to 00 if unknown (19740000 is a valid date).
   */
  dateOfBirth?: number
  /**
   * The date of death encoded as a fuzzy date on 8 positions (YYYYMMDD) MM and/or DD can be set to 00 if unknown (19740000 is a valid date).
   */
  dateOfDeath?: number
  /**
   * Timestamp of the latest validation of the eID of the person..
   */
  timestampOfLatestEidReading?: number
  /**
   * The place of birth.
   */
  placeOfBirth?: string
  /**
   * The place of death.
   */
  placeOfDeath?: string
  /**
   * Is the patient deceased.
   */
  deceased?: boolean
  /**
   * The level of education (college degree, undergraduate, phd).
   */
  education?: string
  /**
   * The current professional activity.
   */
  profession?: string
  /**
   * A text note (can be confidential, encrypted by default).
   * @deprecated use notes instead with proper tags
   */
  note?: string
  /**
   * An administrative note, not confidential.
   * @deprecated use notes instead with proper tags
   */
  administrativeNote?: string
  /**
   * A list of localized notes.
   */
  notes?: Annotation[]
  /**
   * The nationality of the patient.
   */
  nationality?: string
  /**
   * The race of the patient.
   */
  race?: string
  /**
   * The ethnicity of the patient.
   */
  ethnicity?: string
  /**
   * The id of the user that usually handles this patient.
   */
  preferredUserId?: string
  /**
   * A picture usually saved in JPEG format.
   */
  picture?: ArrayBuffer
  /**
   * An external (from another source) id with no guarantee or requirement for unicity .
   */
  externalId?: string
  /**
   * List of insurance coverages (of class Insurability, see below).
   */
  insurabilities?: Array<Insurability>
  /**
   * List of partners, or persons of contact (of class Partnership, see below).
   */
  partnerships?: Array<Partnership>
  /**
   * Links (usually for therapeutic reasons) between this patient and healthcare parties (of class PatientHealthcareParty).
   */
  patientHealthCareParties?: Array<PatientHealthCareParty>
  /**
   * Financial information (Bank, bank account) used to reimburse the patient.
   */
  financialInstitutionInformation?: Array<FinancialInstitutionInformation>
  /**
   * Contracts between the patient and the healthcare entity.
   */
  medicalHouseContracts?: Array<MedicalHouseContract>
  /**
   * Codified list of professions exercised by this patient.
   */
  patientProfessions?: Array<CodeStub>
  /**
   * Extra parameters
   */
  parameters?: { [key: string]: Array<string> }
  /**
   * Extra properties
   */
  properties?: Array<PropertyStub>
  /**
   * For each couple of HcParties (delegator and delegate), this map contains the exchange AES key. The delegator is always this hcp, the key of the map is the id of the delegate.The AES exchange key is encrypted using RSA twice : once using this hcp public key (index 0 in the Array) and once using the other hcp public key (index 1 in the Array). For a pair of HcParties. Each HcParty always has one AES exchange key for himself.
   */
  hcPartyKeys?: { [key: string]: Array<string> }
  /**
   * Extra AES exchange keys, usually the ones we lost access to at some point. The structure is { publicKey: { delegateId: { myPubKey1: aesExKey_for_this, delegatePubKey1: aesExKey_for_delegate } } }
   */
  aesExchangeKeys?: { [key: string]: { [key: string]: { [key: string]: string } } }
  /**
   * Our private keys encrypted with our public keys. The structure is { publicKey1: { publicKey2: privateKey2_encrypted_with_publicKey1, publicKey3: privateKey3_encrypted_with_publicKey1 } }
   */
  transferKeys?: { [key: string]: { [key: string]: string } }
  /**
   * The privateKeyShamirPartitions are used to share this hcp's private RSA key with a series of other hcParties using Shamir's algorithm. The key of the map is the hcp Id with whom this partition has been shared. The value is \"threshold⎮partition in hex\" encrypted using the the partition's holder's public RSA key
   */
  privateKeyShamirPartitions?: { [key: string]: string }
  /**
   * The public key of this hcp
   */
  publicKey?: string
  /**
   * The public keys of this actor that are generates using the OAEP Sha-256 standard
   */
  publicKeysForOaepWithSha256?: Array<string>
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
  /**
   * The id of the medical location where this entity was created.
   */
  medicalLocationId?: string
  nonDuplicateIds?: Array<string>
  encryptedAdministrativesDocuments?: Array<string>
  comment?: string
  warning?: string
  fatherBirthCountry?: CodeStub
  birthCountry?: CodeStub
  nativeCountry?: CodeStub
  socialStatus?: CodeStub
  mainSourceOfIncome?: CodeStub
  schoolingInfos?: Array<SchoolingInfo>
  employementInfos?: Array<EmploymentInfo>
  securityMetadata?: SecurityMetadata
  readonly _type?: EntityWithDelegationTypeName = 'Patient'
}
export namespace Patient {
  export type GenderEnum = 'male' | 'female' | 'indeterminate' | 'changed' | 'changedToMale' | 'changedToFemale' | 'unknown'
  export const GenderEnum = {
    Male: 'male' as GenderEnum,
    Female: 'female' as GenderEnum,
    Indeterminate: 'indeterminate' as GenderEnum,
    Changed: 'changed' as GenderEnum,
    ChangedToMale: 'changedToMale' as GenderEnum,
    ChangedToFemale: 'changedToFemale' as GenderEnum,
    Unknown: 'unknown' as GenderEnum,
  }
  export type BirthSexEnum = 'male' | 'female' | 'indeterminate' | 'changed' | 'changedToMale' | 'changedToFemale' | 'unknown'
  export const BirthSexEnum = {
    Male: 'male' as BirthSexEnum,
    Female: 'female' as BirthSexEnum,
    Indeterminate: 'indeterminate' as BirthSexEnum,
    Changed: 'changed' as BirthSexEnum,
    ChangedToMale: 'changedToMale' as BirthSexEnum,
    ChangedToFemale: 'changedToFemale' as BirthSexEnum,
    Unknown: 'unknown' as BirthSexEnum,
  }
  export type DeactivationReasonEnum = 'deceased' | 'moved' | 'other_doctor' | 'retired' | 'no_contact' | 'unknown' | 'none'
  export const DeactivationReasonEnum = {
    Deceased: 'deceased' as DeactivationReasonEnum,
    Moved: 'moved' as DeactivationReasonEnum,
    OtherDoctor: 'other_doctor' as DeactivationReasonEnum,
    Retired: 'retired' as DeactivationReasonEnum,
    NoContact: 'no_contact' as DeactivationReasonEnum,
    Unknown: 'unknown' as DeactivationReasonEnum,
    None: 'none' as DeactivationReasonEnum,
  }
  export type PersonalStatusEnum =
    | 'single'
    | 'in_couple'
    | 'married'
    | 'separated'
    | 'divorced'
    | 'divorcing'
    | 'widowed'
    | 'widower'
    | 'complicated'
    | 'unknown'
    | 'contract'
    | 'other'
    | 'annulled'
    | 'polygamous'
  export const PersonalStatusEnum = {
    Single: 'single' as PersonalStatusEnum,
    InCouple: 'in_couple' as PersonalStatusEnum,
    Married: 'married' as PersonalStatusEnum,
    Separated: 'separated' as PersonalStatusEnum,
    Divorced: 'divorced' as PersonalStatusEnum,
    Divorcing: 'divorcing' as PersonalStatusEnum,
    Widowed: 'widowed' as PersonalStatusEnum,
    Widower: 'widower' as PersonalStatusEnum,
    Complicated: 'complicated' as PersonalStatusEnum,
    Unknown: 'unknown' as PersonalStatusEnum,
    Contract: 'contract' as PersonalStatusEnum,
    Other: 'other' as PersonalStatusEnum,
    Annulled: 'annulled' as PersonalStatusEnum,
    Polygamous: 'polygamous' as PersonalStatusEnum,
  }
}
