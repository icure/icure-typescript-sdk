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
export declare class iccDocumentApi {
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
  createDocument(body?: models.DocumentDto): Promise<models.DocumentDto | any>
  deleteAttachment(documentId: string): Promise<models.DocumentDto | any>
  deleteDocument(documentIds: string): Promise<models.DocumentDto | any>
  findByHCPartyMessageSecretFKeys(
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.DocumentDto> | any>
  findByTypeHCPartyMessageSecretFKeys(
    documentTypeCode?: string,
    hcPartyId?: string,
    secretFKeys?: string
  ): Promise<Array<models.DocumentDto> | any>
  findWithoutDelegation(limit?: number): Promise<Array<models.DocumentDto> | any>
  getAttachment(
    documentId: string,
    attachmentId: string,
    enckeys?: string,
    fileName?: string
  ): Promise<ArrayBuffer | any>
  getDocument(documentId: string): Promise<models.DocumentDto | any>
  getDocuments(body?: models.ListOfIdsDto): Promise<Array<models.DocumentDto> | any>
  modifyDocument(body?: models.DocumentDto): Promise<models.DocumentDto | any>
  modifyDocuments(body?: Array<models.DocumentDto>): Promise<Array<models.DocumentDto> | any>
  setAttachment(
    documentId: string,
    enckeys?: string,
    body?: Array<string>
  ): Promise<models.DocumentDto | any>
  setAttachmentMulti(
    documentId: string,
    enckeys?: string,
    attachment?: Array<string>
  ): Promise<models.DocumentDto | any>
  setDocumentsDelegations(body?: Array<models.IcureStubDto>): Promise<any | Boolean>
}
