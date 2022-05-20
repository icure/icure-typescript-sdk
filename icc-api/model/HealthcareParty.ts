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
import { FinancialInstitutionInformation } from './FinancialInstitutionInformation'
import { FlatRateTarification } from './FlatRateTarification'
import { HealthcarePartyHistoryStatus } from './HealthcarePartyHistoryStatus'
import { Identifier } from './Identifier'
import { PersonName } from './PersonName'
import { PropertyStub } from './PropertyStub'

/**
 * This entity is a root level object. It represents a healthcare party. It is serialized in JSON and saved in the underlying icure-healthdata CouchDB database.
 */
import { b64_2ab } from './ModelHelper'
export class HealthcareParty {
  constructor(json: JSON | any) {
    Object.assign(this as HealthcareParty, json, json.picture ? { picture: b64_2ab(json.picture) } : {})
  }

  /**
   * the Id of the healthcare party. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * the revision of the healthcare party in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * creation timestamp of the object.
   */
  created?: number
  /**
   * last modification timestamp of the object.
   */
  modified?: number
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  /**
   * The healthcareparty's identifiers, used by the client to identify uniquely and unambiguously the HCP. However, iCure may not guarantee this uniqueness by itself : This should be done at the client side.
   */
  identifier?: Array<Identifier>
  /**
   * A tag is an item from a codification system that qualifies an entity as being member of a certain class, whatever the value it might have taken. If the tag qualifies the content of a field, it means that whatever the content of the field, the tag will always apply. For example, the label of a field is qualified using a tag. LOINC is a codification system typically used for tags.
   */
  tags?: Array<CodeStub>
  /**
   * A code is an item from a codification system that qualifies the content of this entity. SNOMED-CT, ICPC-2 or ICD-10 codifications systems can be used for codes
   */
  codes?: Array<CodeStub>
  /**
   * The full name of the healthcare party, used mainly when the healthcare party is an organization
   */
  name?: string
  /**
   * the lastname (surname) of the healthcare party. This is the official lastname that should be used for official administrative purposes.
   */
  lastName?: string
  /**
   * the firstname (name) of the healthcare party.
   */
  firstName?: string
  /**
   * the list of all names of the healthcare party, also containing the official full name information. Ordered by preference of use. First element is therefore the official name used for the healthcare party in the application
   */
  names?: Array<PersonName>
  /**
   * the gender of the healthcare party: male, female, indeterminate, changed, changedToMale, changedToFemale, unknown
   */
  gender?: HealthcareParty.GenderEnum
  /**
   * Mr., Ms., Pr., Dr. ...
   */
  civility?: string
  /**
   * The name of the company this healthcare party is member of
   */
  companyName?: string
  /**
   * Medical specialty of the healthcare party
   */
  speciality?: string
  /**
   * Bank Account identifier of the healhtcare party, IBAN, deprecated, use financial institutions instead
   */
  bankAccount?: string
  /**
   * Bank Identifier Code, the SWIFT Address assigned to the bank, use financial institutions instead
   */
  bic?: string
  proxyBankAccount?: string
  proxyBic?: string
  /**
   * All details included in the invoice header
   */
  invoiceHeader?: string
  /**
   * Identifier number for institution type if the healthcare party is an enterprise
   */
  cbe?: string
  /**
   * Identifier number for the institution if the healthcare party is an organization
   */
  ehp?: string
  /**
   * The id of the user that usually handles this healthcare party.
   */
  userId?: string
  /**
   * Id of parent of the user representing the healthcare party.
   */
  parentId?: string
  convention?: number
  /**
   * National Institute for Health and Invalidity Insurance number assigned to healthcare parties (institution or person).
   */
  nihii?: string
  nihiiSpecCode?: string
  /**
   * Social security inscription number.
   */
  ssin?: string
  /**
   * The list of addresses (with address type).
   */
  addresses?: Array<Address>
  /**
   * The list of languages spoken by the patient ordered by fluency (alpha-2 code http://www.loc.gov/standards/iso639-2/ascii_8bits.html).
   */
  languages?: Array<string>
  /**
   * A picture usually saved in JPEG format.
   */
  picture?: ArrayBuffer
  /**
   * The healthcare party's status: 'trainee' or 'withconvention' or 'accredited'
   */
  statuses?: Array<HealthcareParty.StatusesEnum>
  /**
   * The healthcare party's status history
   */
  statusHistory?: Array<HealthcarePartyHistoryStatus>
  /**
   * Medical specialty of the healthcare party codified using FHIR or Kmehr codificaiton scheme
   */
  specialityCodes?: Array<CodeStub>
  /**
   * The type of format for contacting the healthcare party, ex: mobile, phone, email, etc.
   */
  sendFormats?: { [key: string]: string }
  /**
   * Text notes.
   */
  notes?: string
  /**
   * List of financial information (Bank, bank account).
   */
  financialInstitutionInformation?: Array<FinancialInstitutionInformation>
  /**
   * A description of the HCP, meant for the public and in multiple languages.
   */
  descr?: { [key: string]: string }
  /**
   * The invoicing scheme this healthcare party adheres to : 'service fee' or 'flat rate'
   */
  billingType?: string
  type?: string
  contactPerson?: string
  contactPersonHcpId?: string
  supervisorId?: string
  flatRateTarifications?: Array<FlatRateTarification>
  importedData?: { [key: string]: string }
  options?: { [key: string]: string }
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
}
export namespace HealthcareParty {
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
  export type StatusesEnum = 'trainee' | 'withconvention' | 'accreditated'
  export const StatusesEnum = {
    Trainee: 'trainee' as StatusesEnum,
    Withconvention: 'withconvention' as StatusesEnum,
    Accreditated: 'accreditated' as StatusesEnum,
  }
}
