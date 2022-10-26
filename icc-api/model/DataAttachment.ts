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

/**
 * Represent an attachment holding some additional data for an entity.
 */
export class DataAttachment {
  constructor(json: JSON | any) {
    Object.assign(this as DataAttachment, json)
  }

  /**
   * Id of the attachment, if stored as a couchdb attachment
   */
  couchDbAttachmentId?: string
  /**
   * Id of the attachment, if stored using the object storage service
   */
  objectStoreAttachmentId?: string
  /**
   * The Uniform Type Identifiers (https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/understanding_utis/understand_utis_conc/understand_utis_conc.html#//apple_ref/doc/uid/TP40001319-CH202-CHDHIJDE) of the attachment.
   * This is an array to allow representing a priority, but each UTI must be unique.
   */
  utis?: Array<string>
}
