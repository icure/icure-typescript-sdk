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

import { decodeBase64 } from "./ModelHelper"

export class PartnershipDto {
  constructor(json: JSON | any) {
    Object.assign(this as PartnershipDto, json)
  }

  type?: PartnershipDto.TypeEnum
  status?: PartnershipDto.StatusEnum
  partnerId?: string
  meToOtherRelationshipDescription?: string
  otherToMeRelationshipDescription?: string
}
export namespace PartnershipDto {
  export type TypeEnum =
    | "primary_contact"
    | "primary_contact_for"
    | "family"
    | "friend"
    | "counselor"
    | "contact"
    | "brother"
    | "brotherinlaw"
    | "child"
    | "daughter"
    | "employer"
    | "father"
    | "grandchild"
    | "grandparent"
    | "husband"
    | "lawyer"
    | "mother"
    | "neighbour"
    | "notary"
    | "partner"
    | "sister"
    | "sisterinlaw"
    | "son"
    | "spouse"
    | "stepdaughter"
    | "stepfather"
    | "stepmother"
    | "stepson"
    | "tutor"
  export const TypeEnum = {
    PrimaryContact: "primary_contact" as TypeEnum,
    PrimaryContactFor: "primary_contact_for" as TypeEnum,
    Family: "family" as TypeEnum,
    Friend: "friend" as TypeEnum,
    Counselor: "counselor" as TypeEnum,
    Contact: "contact" as TypeEnum,
    Brother: "brother" as TypeEnum,
    Brotherinlaw: "brotherinlaw" as TypeEnum,
    Child: "child" as TypeEnum,
    Daughter: "daughter" as TypeEnum,
    Employer: "employer" as TypeEnum,
    Father: "father" as TypeEnum,
    Grandchild: "grandchild" as TypeEnum,
    Grandparent: "grandparent" as TypeEnum,
    Husband: "husband" as TypeEnum,
    Lawyer: "lawyer" as TypeEnum,
    Mother: "mother" as TypeEnum,
    Neighbour: "neighbour" as TypeEnum,
    Notary: "notary" as TypeEnum,
    Partner: "partner" as TypeEnum,
    Sister: "sister" as TypeEnum,
    Sisterinlaw: "sisterinlaw" as TypeEnum,
    Son: "son" as TypeEnum,
    Spouse: "spouse" as TypeEnum,
    Stepdaughter: "stepdaughter" as TypeEnum,
    Stepfather: "stepfather" as TypeEnum,
    Stepmother: "stepmother" as TypeEnum,
    Stepson: "stepson" as TypeEnum,
    Tutor: "tutor" as TypeEnum
  }
  export type StatusEnum = "active" | "complicated" | "past"
  export const StatusEnum = {
    Active: "active" as StatusEnum,
    Complicated: "complicated" as StatusEnum,
    Past: "past" as StatusEnum
  }
}
