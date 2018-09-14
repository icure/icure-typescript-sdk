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

import * as models from "./models"

export class ServiceDto {
  constructor(json: JSON | any) {
    Object.assign(this as ServiceDto, json)
  }
  id?: string

  contactId?: string

  cryptedForeignKeys?: { [key: string]: Array<models.DelegationDto> }

  delegations?: { [key: string]: Array<models.DelegationDto> }

  subContactIds?: Array<string>

  plansOfActionIds?: Array<string>

  healthElementsIds?: Array<string>

  label?: string

  dataClassName?: string

  index?: number

  content?: { [key: string]: models.ContentDto }

  encryptedContent?: string

  textIndexes?: { [key: string]: string }

  valueDate?: number

  openingDate?: number

  closingDate?: number

  created?: number

  modified?: number

  endOfLife?: number

  formId?: string

  author?: string

  responsible?: string

  comment?: string

  status?: number

  invoicingCodes?: Array<string>

  codes?: Array<models.CodeDto>

  tags?: Array<models.CodeDto>

  encryptedSelf?: string
}
