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

export class MedicationDto {
  constructor(json: JSON | any) {
    Object.assign(this as MedicationDto, json)
  }
  compoundPrescription?: string

  substanceProduct?: models.SubstanceproductDto

  medicinalProduct?: models.MedicinalproductDto

  numberOfPackages?: number

  batch?: string

  instructionForPatient?: string

  commentForDelivery?: string

  drugRoute?: string

  temporality?: string

  duration?: models.DurationDto

  renewal?: models.RenewalDto

  beginMoment?: number

  endMoment?: number

  knownUsage?: boolean

  frequency?: models.CodeDto

  reimbursementReason?: models.CodeDto

  substitutionAllowed?: boolean

  regimen?: Array<models.RegimenItemDto>

  posology?: string

  options?: { [key: string]: models.ContentDto }

  agreements?: { [key: string]: models.ParagraphAgreementDto }

  medicationSchemeIdOnSafe?: string

  medicationSchemeSafeVersion?: number

  medicationSchemeTimeStampOnSafe?: number

  medicationSchemeDocumentId?: string

  safeIdName?: string

  idOnSafes?: string

  timestampOnSafe?: number

  changeValidated?: boolean

  newSafeMedication?: boolean

  medicationUse?: string

  beginCondition?: string

  endCondition?: string

  origin?: string

  medicationChanged?: boolean

  posologyChanged?: boolean

  prescriptionRID?: string
}
