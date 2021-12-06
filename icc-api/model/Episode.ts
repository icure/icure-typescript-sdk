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
 * List of episodes of occurrences of the healthcare element.
 */
export class Episode { 
    constructor(json: JSON | any) {
        Object.assign(this as Episode, json)
    }

    id?: string;
    name?: string;
    comment?: string;
    startDate?: number;
    endDate?: number;
    /**
     * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
     */
    encryptedSelf?: string;
}

