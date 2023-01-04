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
import { AbstractFilterHealthcareParty } from '../../icc-api/model/AbstractFilterHealthcareParty'

export class HealthcarePartyByNameFilter extends AbstractFilterHealthcareParty {
  $type: string = 'HealthcarePartyByNameFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as HealthcarePartyByNameFilter, json)
  }

  descending?: boolean
  name: string = ''
  desc?: string
}