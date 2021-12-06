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
import { Predicate } from './Predicate';

/**
 * Revoked permissions.
 */
export class PermissionItem { 
    constructor(json: JSON | any) {
        Object.assign(this as PermissionItem, json)
    }

    type?: PermissionItem.TypeEnum;
    predicate?: Predicate;
}
export namespace PermissionItem {
    export type TypeEnum = 'AUTHENTICATE' | 'ADMIN' | 'PATIENT_VIEW' | 'PATIENT_CREATE' | 'PATIENT_CHANGE_DELETE' | 'MEDICAL_DATA_VIEW' | 'MEDICAL_DATA_CREATE' | 'MEDICAL_CHANGE_DELETE' | 'FINANCIAL_DATA_VIEW' | 'FINANCIAL_DATA_CREATE' | 'FINANCIAL_CHANGE_DELETE';
    export const TypeEnum = {
        AUTHENTICATE: 'AUTHENTICATE' as TypeEnum,
        ADMIN: 'ADMIN' as TypeEnum,
        PATIENTVIEW: 'PATIENT_VIEW' as TypeEnum,
        PATIENTCREATE: 'PATIENT_CREATE' as TypeEnum,
        PATIENTCHANGEDELETE: 'PATIENT_CHANGE_DELETE' as TypeEnum,
        MEDICALDATAVIEW: 'MEDICAL_DATA_VIEW' as TypeEnum,
        MEDICALDATACREATE: 'MEDICAL_DATA_CREATE' as TypeEnum,
        MEDICALCHANGEDELETE: 'MEDICAL_CHANGE_DELETE' as TypeEnum,
        FINANCIALDATAVIEW: 'FINANCIAL_DATA_VIEW' as TypeEnum,
        FINANCIALDATACREATE: 'FINANCIAL_DATA_CREATE' as TypeEnum,
        FINANCIALCHANGEDELETE: 'FINANCIAL_CHANGE_DELETE' as TypeEnum
    };
}

