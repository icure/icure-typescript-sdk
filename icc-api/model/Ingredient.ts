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
import { Quantity } from './Quantity'
import { SubstanceStub } from './SubstanceStub'

export class Ingredient {
  constructor(json: JSON | any) {
    Object.assign(this as Ingredient, json)
  }

  from?: number
  to?: number
  rank?: number
  type?: Ingredient.TypeEnum
  knownEffect?: boolean
  strengthDescription?: string
  strength?: Quantity
  additionalInformation?: string
  substance?: SubstanceStub
}
export namespace Ingredient {
  export type TypeEnum = 'ACTIVE_SUBSTANCE' | 'EXCIPIENT'
  export const TypeEnum = {
    ACTIVESUBSTANCE: 'ACTIVE_SUBSTANCE' as TypeEnum,
    EXCIPIENT: 'EXCIPIENT' as TypeEnum,
  }
}
