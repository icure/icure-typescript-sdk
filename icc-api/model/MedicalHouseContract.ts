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
 * Contracts between the patient and the healthcare entity.
 */
export class MedicalHouseContract { 
    constructor(json: JSON | any) {
        Object.assign(this as MedicalHouseContract, json)
    }

    contractId?: string;
    validFrom?: number;
    validTo?: number;
    mmNihii?: string;
    hcpId?: string;
    changeType?: MedicalHouseContract.ChangeTypeEnum;
    parentContractId?: string;
    changedBy?: string;
    startOfContract?: number;
    startOfCoverage?: number;
    endOfContract?: number;
    endOfCoverage?: number;
    kine?: boolean;
    gp?: boolean;
    ptd?: boolean;
    nurse?: boolean;
    noKine?: boolean;
    noGp?: boolean;
    noNurse?: boolean;
    unsubscriptionReasonId?: number;
    ptdStart?: number;
    ptdEnd?: number;
    ptdLastInvoiced?: number;
    startOfSuspension?: number;
    endOfSuspension?: number;
    suspensionReason?: MedicalHouseContract.SuspensionReasonEnum;
    suspensionSource?: string;
    forcedSuspension?: boolean;
    signatureType?: MedicalHouseContract.SignatureTypeEnum;
    status?: number;
    options?: { [key: string]: string; };
    receipts?: { [key: string]: string; };
    /**
     * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
     */
    encryptedSelf?: string;
}
export namespace MedicalHouseContract {
    export type ChangeTypeEnum = 'inscriptionStart' | 'inscriptionEnd' | 'suspension' | 'coverageChange';
    export const ChangeTypeEnum = {
        InscriptionStart: 'inscriptionStart' as ChangeTypeEnum,
        InscriptionEnd: 'inscriptionEnd' as ChangeTypeEnum,
        Suspension: 'suspension' as ChangeTypeEnum,
        CoverageChange: 'coverageChange' as ChangeTypeEnum
    };
    export type SuspensionReasonEnum = 'notInsured' | 'noReasonGiven' | 'isHospitalized' | 'outsideOfCountry' | 'changeOfMutuality';
    export const SuspensionReasonEnum = {
        NotInsured: 'notInsured' as SuspensionReasonEnum,
        NoReasonGiven: 'noReasonGiven' as SuspensionReasonEnum,
        IsHospitalized: 'isHospitalized' as SuspensionReasonEnum,
        OutsideOfCountry: 'outsideOfCountry' as SuspensionReasonEnum,
        ChangeOfMutuality: 'changeOfMutuality' as SuspensionReasonEnum
    };
    export type SignatureTypeEnum = 'holderEid' | 'holderPaper' | 'legalrepresentativeEid' | 'legalrepresentativePaper';
    export const SignatureTypeEnum = {
        HolderEid: 'holderEid' as SignatureTypeEnum,
        HolderPaper: 'holderPaper' as SignatureTypeEnum,
        LegalrepresentativeEid: 'legalrepresentativeEid' as SignatureTypeEnum,
        LegalrepresentativePaper: 'legalrepresentativePaper' as SignatureTypeEnum
    };
}

