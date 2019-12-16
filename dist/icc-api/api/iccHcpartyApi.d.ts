/**
 *
 * No description provided (generated by Swagger Codegen https://github.com/swagger-api/swagger-codegen)
 *
 * OpenAPI spec version: 1.0.2
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { XHR } from "./XHR"
import * as models from "../model/models"
export declare class iccHcpartyApi {
  host: string
  headers: Array<XHR.Header>
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  constructor(
    host: string,
    headers: any,
    fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  )
  setHeaders(h: Array<XHR.Header>): void
  handleError(e: XHR.Data): void
  createHealthcareParty(body?: models.HealthcarePartyDto): Promise<models.HealthcarePartyDto | any>
  createHealthcarePartySignUp(body?: models.SignUpDto): Promise<models.HealthcarePartyDto | any>
  createTemplateReplication(
    replicationHost: string,
    language: string,
    specialtyCode: string,
    protocol?: string,
    port?: string
  ): Promise<models.ReplicationDto | any>
  deleteHealthcareParties(healthcarePartyIds: string): Promise<Array<string> | any>
  findByName(
    name?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    desc?: boolean
  ): Promise<models.HcPartyPaginatedList | any>
  findBySpecialityAndPostCode(
    type?: string,
    spec?: string,
    firstCode?: string,
    lastCode?: string,
    limit?: number
  ): Promise<models.HcPartyPaginatedList | any>
  findBySsinOrNihii(
    searchValue: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    desc?: boolean
  ): Promise<models.HcPartyPaginatedList | any>
  getCurrentHealthcareParty(): Promise<models.HealthcarePartyDto | any>
  getHcPartyKeysForDelegate(
    healthcarePartyId: string
  ): Promise<
    | {
        [key: string]: string
      }
    | any
  >
  getHealthcareParties(healthcarePartyIds: string): Promise<Array<models.HealthcarePartyDto> | any>
  getHealthcarePartiesByParentId(parentId: string): Promise<Array<models.HealthcarePartyDto> | any>
  getHealthcareParty(healthcarePartyId: string): Promise<models.HealthcarePartyDto | any>
  getPublicKey(healthcarePartyId: string): Promise<models.PublicKeyDto | any>
  listByName(name: string): Promise<Array<models.HealthcarePartyDto> | any>
  listHealthcareParties(
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    desc?: boolean
  ): Promise<models.HcPartyPaginatedList | any>
  modifyHealthcareParty(body?: models.HealthcarePartyDto): Promise<models.HealthcarePartyDto | any>
}
