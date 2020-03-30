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

export class UserStubDto {
  constructor(json: JSON | any) {
    Object.assign(this as UserStubDto, json)
  }

  id?: string
  rev?: string
  deletionDate?: number
  name?: string
  healthcarePartyId?: string
  patientId?: string
  email?: string
  autoDelegations?: { [key: string]: Array<string> }
  virtualHostDependency?: UserStubDto.VirtualHostDependencyEnum
  virtualHosts?: Array<string>
}
export namespace UserStubDto {
  export type VirtualHostDependencyEnum = "NONE" | "DIRECT" | "FULL"
  export const VirtualHostDependencyEnum = {
    NONE: "NONE" as VirtualHostDependencyEnum,
    DIRECT: "DIRECT" as VirtualHostDependencyEnum,
    FULL: "FULL" as VirtualHostDependencyEnum
  }
}
