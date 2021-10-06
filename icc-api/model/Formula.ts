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

import { decodeBase64 } from "./ModelHelper"

export class Formula {
  constructor(json: JSON | any) {
    Object.assign(this as Formula, json)
  }

  value?: string
  lifecycle?: Formula.LifecycleEnum
}
export namespace Formula {
  export type LifecycleEnum =
    | "OnCreate"
    | "OnLoad"
    | "OnChange"
    | "OnSave"
    | "OnDestroy"
    | "OnLoadPropertiesEditor"
  export const LifecycleEnum = {
    OnCreate: "OnCreate" as LifecycleEnum,
    OnLoad: "OnLoad" as LifecycleEnum,
    OnChange: "OnChange" as LifecycleEnum,
    OnSave: "OnSave" as LifecycleEnum,
    OnDestroy: "OnDestroy" as LifecycleEnum,
    OnLoadPropertiesEditor: "OnLoadPropertiesEditor" as LifecycleEnum,
  }
}
