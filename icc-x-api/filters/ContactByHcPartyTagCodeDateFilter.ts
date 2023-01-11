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
import { AbstractFilterContact } from '../../icc-api/model/AbstractFilterContact'

export class ContactByHcPartyTagCodeDateFilter extends AbstractFilterContact {
  $type: string = 'ContactByHcPartyTagCodeDateFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ContactByHcPartyTagCodeDateFilter, json)
  }

  desc?: string
  healthcarePartyId?: string
  tagType?: string
  tagCode?: string
  codeType?: string
  codeCode?: string
  startOfContactOpeningDate?: number
  endOfContactOpeningDate?: number
}
