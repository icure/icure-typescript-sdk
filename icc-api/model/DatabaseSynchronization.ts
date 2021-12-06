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

export class DatabaseSynchronization { 
    constructor(json: JSON | any) {
        Object.assign(this as DatabaseSynchronization, json)
    }

    source?: string;
    target?: string;
    filter?: string;
    localTarget?: DatabaseSynchronization.LocalTargetEnum;
}
export namespace DatabaseSynchronization {
    export type LocalTargetEnum = 'base' | 'healthdata' | 'patient';
    export const LocalTargetEnum = {
        Base: 'base' as LocalTargetEnum,
        Healthdata: 'healthdata' as LocalTargetEnum,
        Patient: 'patient' as LocalTargetEnum
    };
}

