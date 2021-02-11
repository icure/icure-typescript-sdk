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

/**
 * This class represents a coverage of a patient by an insurance during a period or time.
 */
import { decodeBase64 } from "./ModelHelper"

export class Insurability {
  constructor(json: JSON | any) {
    Object.assign(this as Insurability, json)
  }

  /**
   * Insurance extra parameters.
   */
  parameters?: { [key: string]: string }
  /**
   * Is hospitalization covered.
   */
  hospitalisation?: boolean
  /**
   * Is outpatient care covered.
   */
  ambulatory?: boolean
  /**
   * Is dental care covered.
   */
  dental?: boolean
  /**
   * Identification number of the patient at the insurance.
   */
  identificationNumber?: string
  /**
   * Id of the Insurance.
   */
  insuranceId?: string
  /**
   * Start date of the coverage (YYYYMMDD).
   */
  startDate?: number
  /**
   * End date of the coverage (YYYYMMDD).
   */
  endDate?: number
  /**
   * UUID of the contact person who is the policyholder of the insurance (when the patient is covered by the insurance of a third person).
   */
  titularyId?: string
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
