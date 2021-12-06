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

export class EntityReference { 
    constructor(json: JSON | any) {
        Object.assign(this as EntityReference, json)
    }

    id?: string;
    rev?: string;
    /**
     * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
     */
    deletionDate?: number;
    docId?: string;
}

