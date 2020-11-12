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
import { Content } from "./Content"
import { Editor } from "./Editor"
import { FormDataOption } from "./FormDataOption"
import { FormPlanning } from "./FormPlanning"
import { Formula } from "./Formula"
import { GuiCode } from "./GuiCode"
import { GuiCodeType } from "./GuiCodeType"
import { Suggest } from "./Suggest"

import { decodeBase64 } from "./ModelHelper"

export class FormLayoutData {
  constructor(json: JSON | any) {
    Object.assign(this as FormLayoutData, json)
  }

  subForm?: boolean
  irrelevant?: boolean
  determinesSscontactName?: boolean
  type?: string
  name?: string
  sortOrder?: number
  options?: { [key: string]: FormDataOption }
  descr?: string
  label?: string
  editor?: Editor
  defaultValue?: Array<Content>
  defaultStatus?: number
  suggest?: Array<Suggest>
  plannings?: Array<FormPlanning>
  tags?: Array<GuiCode>
  codes?: Array<GuiCode>
  codeTypes?: Array<GuiCodeType>
  formulas?: Array<Formula>
}
