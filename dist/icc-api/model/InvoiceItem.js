"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
class InvoiceItem {
  constructor(json) {
    Object.assign(this, json)
  }
}
exports.InvoiceItem = InvoiceItem
;(function(InvoiceItem) {
  let SideCodeEnum
  ;(function(SideCodeEnum) {
    SideCodeEnum[(SideCodeEnum["None"] = "None")] = "None"
    SideCodeEnum[(SideCodeEnum["Left"] = "Left")] = "Left"
    SideCodeEnum[(SideCodeEnum["Right"] = "Right")] = "Right"
  })((SideCodeEnum = InvoiceItem.SideCodeEnum || (InvoiceItem.SideCodeEnum = {})))
  let TimeOfDayEnum
  ;(function(TimeOfDayEnum) {
    TimeOfDayEnum[(TimeOfDayEnum["Other"] = "Other")] = "Other"
    TimeOfDayEnum[(TimeOfDayEnum["Night"] = "Night")] = "Night"
    TimeOfDayEnum[(TimeOfDayEnum["Weekend"] = "Weekend")] = "Weekend"
    TimeOfDayEnum[(TimeOfDayEnum["Bankholiday"] = "Bankholiday")] = "Bankholiday"
    TimeOfDayEnum[(TimeOfDayEnum["Urgent"] = "Urgent")] = "Urgent"
  })((TimeOfDayEnum = InvoiceItem.TimeOfDayEnum || (InvoiceItem.TimeOfDayEnum = {})))
  let DerogationMaxNumberEnum
  ;(function(DerogationMaxNumberEnum) {
    DerogationMaxNumberEnum[(DerogationMaxNumberEnum["Other"] = "Other")] = "Other"
    DerogationMaxNumberEnum[
      (DerogationMaxNumberEnum["DerogationMaxNumber"] = "DerogationMaxNumber")
    ] =
      "DerogationMaxNumber"
    DerogationMaxNumberEnum[(DerogationMaxNumberEnum["OtherPrescription"] = "OtherPrescription")] =
      "OtherPrescription"
    DerogationMaxNumberEnum[
      (DerogationMaxNumberEnum["SecondPrestationOfDay"] = "SecondPrestationOfDay")
    ] =
      "SecondPrestationOfDay"
    DerogationMaxNumberEnum[
      (DerogationMaxNumberEnum["ThirdAndNextPrestationOfDay"] = "ThirdAndNextPrestationOfDay")
    ] =
      "ThirdAndNextPrestationOfDay"
  })(
    (DerogationMaxNumberEnum =
      InvoiceItem.DerogationMaxNumberEnum || (InvoiceItem.DerogationMaxNumberEnum = {}))
  )
  let PrescriberNormEnum
  ;(function(PrescriberNormEnum) {
    PrescriberNormEnum[(PrescriberNormEnum["None"] = "None")] = "None"
    PrescriberNormEnum[(PrescriberNormEnum["OnePrescriber"] = "OnePrescriber")] = "OnePrescriber"
    PrescriberNormEnum[(PrescriberNormEnum["SelfPrescriber"] = "SelfPrescriber")] = "SelfPrescriber"
    PrescriberNormEnum[(PrescriberNormEnum["AddedCode"] = "AddedCode")] = "AddedCode"
    PrescriberNormEnum[(PrescriberNormEnum["ManyPrescribers"] = "ManyPrescribers")] =
      "ManyPrescribers"
  })((PrescriberNormEnum = InvoiceItem.PrescriberNormEnum || (InvoiceItem.PrescriberNormEnum = {})))
  let PercentNormEnum
  ;(function(PercentNormEnum) {
    PercentNormEnum[(PercentNormEnum["None"] = "None")] = "None"
    PercentNormEnum[(PercentNormEnum["SurgicalAid1"] = "SurgicalAid1")] = "SurgicalAid1"
    PercentNormEnum[(PercentNormEnum["SurgicalAid2"] = "SurgicalAid2")] = "SurgicalAid2"
    PercentNormEnum[(PercentNormEnum["ReducedFee"] = "ReducedFee")] = "ReducedFee"
    PercentNormEnum[(PercentNormEnum["Ah1n1"] = "Ah1n1")] = "Ah1n1"
    PercentNormEnum[(PercentNormEnum["HalfPriceSecondAct"] = "HalfPriceSecondAct")] =
      "HalfPriceSecondAct"
    PercentNormEnum[(PercentNormEnum["InvoiceException"] = "InvoiceException")] = "InvoiceException"
    PercentNormEnum[(PercentNormEnum["ForInformation"] = "ForInformation")] = "ForInformation"
  })((PercentNormEnum = InvoiceItem.PercentNormEnum || (InvoiceItem.PercentNormEnum = {})))
})((InvoiceItem = exports.InvoiceItem || (exports.InvoiceItem = {})))
//# sourceMappingURL=InvoiceItem.js.map
