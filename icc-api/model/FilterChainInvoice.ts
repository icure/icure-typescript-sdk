/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { AbstractFilterInvoice } from "./AbstractFilterInvoice"
import { Predicate } from "./Predicate"

import { decodeBase64 } from "./ModelHelper"

export class FilterChainInvoice {
  constructor(json: JSON | any) {
    Object.assign(this as FilterChainInvoice, json)
  }

  filter?: AbstractFilterInvoice
  predicate?: Predicate
}
