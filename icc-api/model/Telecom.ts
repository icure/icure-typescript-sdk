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
 * This entity represents available contact details of a user, reachable by telecom methods
 */
export class Telecom { 
    constructor(json: JSON | any) {
        Object.assign(this as Telecom, json)
    }

    /**
     * The type of telecom method being used, ex: landline phone, mobile phone, email, fax, etc.
     */
    telecomType?: Telecom.TelecomTypeEnum;
    telecomNumber?: string;
    telecomDescription?: string;
    /**
     * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
     */
    encryptedSelf?: string;
}
export namespace Telecom {
    export type TelecomTypeEnum = 'mobile' | 'phone' | 'email' | 'fax' | 'skype' | 'im' | 'medibridge' | 'ehealthbox' | 'apicrypt' | 'web' | 'print' | 'disk' | 'other' | 'pager';
    export const TelecomTypeEnum = {
        Mobile: 'mobile' as TelecomTypeEnum,
        Phone: 'phone' as TelecomTypeEnum,
        Email: 'email' as TelecomTypeEnum,
        Fax: 'fax' as TelecomTypeEnum,
        Skype: 'skype' as TelecomTypeEnum,
        Im: 'im' as TelecomTypeEnum,
        Medibridge: 'medibridge' as TelecomTypeEnum,
        Ehealthbox: 'ehealthbox' as TelecomTypeEnum,
        Apicrypt: 'apicrypt' as TelecomTypeEnum,
        Web: 'web' as TelecomTypeEnum,
        Print: 'print' as TelecomTypeEnum,
        Disk: 'disk' as TelecomTypeEnum,
        Other: 'other' as TelecomTypeEnum,
        Pager: 'pager' as TelecomTypeEnum
    };
}

