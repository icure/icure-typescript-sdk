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

export class SumehrValidity {
  constructor(json: JSON | any) {
    Object.assign(this as SumehrValidity, json)
  }

  sumehrValid?: SumehrValidity.SumehrValidEnum
}
export namespace SumehrValidity {
  export type SumehrValidEnum = 'absent' | 'uptodate' | 'outdated'
  export const SumehrValidEnum = {
    Absent: 'absent' as SumehrValidEnum,
    Uptodate: 'uptodate' as SumehrValidEnum,
    Outdated: 'outdated' as SumehrValidEnum,
  }
}
