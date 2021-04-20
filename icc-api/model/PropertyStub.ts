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
import { PropertyTypeStub } from './PropertyTypeStub'
import { TypedValueObject } from './TypedValueObject'

/**
 * Extra properties for the user. Those properties are typed (see class Property)
 */
export class PropertyStub {
  constructor(json: JSON | any) {
    Object.assign(this as PropertyStub, json)
  }

  type?: PropertyTypeStub
  typedValue?: TypedValueObject
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
