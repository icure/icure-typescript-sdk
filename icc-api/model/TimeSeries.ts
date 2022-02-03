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
 * A high frequency time-series containing the ts in ms from the start (double) and the values
 */
export class TimeSeries {
  constructor(json: JSON | any) {
    Object.assign(this as TimeSeries, json)
  }

  fields?: Array<string>
  samples?: Array<Array<number>>
  min?: Array<number>
  max?: Array<number>
  mean?: Array<number>
  median?: Array<number>
  variance?: Array<number>
}