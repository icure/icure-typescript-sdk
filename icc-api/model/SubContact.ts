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
import { ServiceLink } from './ServiceLink'

/**
 * This entity represents a sub-contact. It is serialized in JSON and saved in the underlying icure-contact CouchDB database.
 */
export class SubContact {
  constructor(json: JSON | any) {
    Object.assign(this as SubContact, json)
  }

  /**
   * The Id of the sub-contact. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
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
   * Description of the sub-contact
   */
  descr?: string
  /**
   * Protocol based on which the sub-contact was used for linking services to structuring elements
   */
  protocol?: string
  status?: number
  /**
   * Id of the form used in the sub-contact. Several sub-contacts with the same form ID can coexist as long as they are in different contacts or they relate to a different planOfActionID
   */
  formId?: string
  /**
   * Id of the plan of action (healthcare approach) that is linked by the sub-contact to a service.
   */
  planOfActionId?: string
  /**
   * Id of the healthcare element that is linked by the sub-contact to a service
   */
  healthElementId?: string
  classificationId?: string
  /**
   * List of all services provided to the patient under a given contact which is linked by this sub-contact to other structuring elements.
   */
  services?: Array<ServiceLink>
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
