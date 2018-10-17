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

export class DocumentTemplateDto {
  constructor(json: JSON | any) {
    Object.assign(this as DocumentTemplateDto, json)
  }
  id?: string

  rev?: string

  deletionDate?: number

  modified?: number

  created?: number

  owner?: string

  guid?: string

  attachmentId?: string

  documentType?: DocumentTemplateDto.DocumentTypeEnum

  mainUti?: string

  group?: models.DocumentGroupDto

  name?: string

  descr?: string

  disabled?: string

  specialty?: models.CodeDto
}
export namespace DocumentTemplateDto {
  export enum DocumentTypeEnum {
    Admission = <any>"admission",
    Alert = <any>"alert",
    BvtSample = <any>"bvt_sample",
    Clinicalpath = <any>"clinicalpath",
    Clinicalsummary = <any>"clinicalsummary",
    Contactreport = <any>"contactreport",
    Quote = <any>"quote",
    Invoice = <any>"invoice",
    Death = <any>"death",
    Discharge = <any>"discharge",
    Dischargereport = <any>"dischargereport",
    EbirthBabyMedicalform = <any>"ebirth_baby_medicalform",
    EbirthBabyNotification = <any>"ebirth_baby_notification",
    EbirthMotherMedicalform = <any>"ebirth_mother_medicalform",
    EbirthMotherNotification = <any>"ebirth_mother_notification",
    EcareSafeConsultation = <any>"ecare_safe_consultation",
    Epidemiology = <any>"epidemiology",
    Intervention = <any>"intervention",
    Labrequest = <any>"labrequest",
    Labresult = <any>"labresult",
    Medicaladvisoragreement = <any>"medicaladvisoragreement",
    Medicationschemeelement = <any>"medicationschemeelement",
    Note = <any>"note",
    Notification = <any>"notification",
    Pharmaceuticalprescription = <any>"pharmaceuticalprescription",
    Prescription = <any>"prescription",
    Productdelivery = <any>"productdelivery",
    Quickdischargereport = <any>"quickdischargereport",
    Radiationexposuremonitoring = <any>"radiationexposuremonitoring",
    Referral = <any>"referral",
    Report = <any>"report",
    Request = <any>"request",
    Result = <any>"result",
    Sumehr = <any>"sumehr",
    Telemonitoring = <any>"telemonitoring",
    Template = <any>"template",
    TemplateAdmin = <any>"template_admin",
    Treatmentsuspension = <any>"treatmentsuspension",
    Vaccination = <any>"vaccination"
  }
}
