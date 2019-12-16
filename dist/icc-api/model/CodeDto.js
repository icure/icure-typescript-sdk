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
class CodeDto {
  constructor(json) {
    Object.assign(this, json)
  }
}
exports.CodeDto = CodeDto
;(function(CodeDto) {
  let FlagsEnum
  ;(function(FlagsEnum) {
    FlagsEnum[(FlagsEnum["MaleOnly"] = "male_only")] = "MaleOnly"
    FlagsEnum[(FlagsEnum["FemaleOnly"] = "female_only")] = "FemaleOnly"
    FlagsEnum[(FlagsEnum["Deptkinesitherapy"] = "deptkinesitherapy")] = "Deptkinesitherapy"
    FlagsEnum[(FlagsEnum["Deptnursing"] = "deptnursing")] = "Deptnursing"
    FlagsEnum[(FlagsEnum["Deptgeneralpractice"] = "deptgeneralpractice")] = "Deptgeneralpractice"
    FlagsEnum[(FlagsEnum["Deptsocialworker"] = "deptsocialworker")] = "Deptsocialworker"
    FlagsEnum[(FlagsEnum["Deptpsychology"] = "deptpsychology")] = "Deptpsychology"
    FlagsEnum[(FlagsEnum["Deptadministrative"] = "deptadministrative")] = "Deptadministrative"
    FlagsEnum[(FlagsEnum["Deptdietetics"] = "deptdietetics")] = "Deptdietetics"
    FlagsEnum[(FlagsEnum["Deptspeechtherapy"] = "deptspeechtherapy")] = "Deptspeechtherapy"
    FlagsEnum[(FlagsEnum["Deptdentistry"] = "deptdentistry")] = "Deptdentistry"
    FlagsEnum[(FlagsEnum["Deptoccupationaltherapy"] = "deptoccupationaltherapy")] =
      "Deptoccupationaltherapy"
    FlagsEnum[(FlagsEnum["Depthealthcare"] = "depthealthcare")] = "Depthealthcare"
    FlagsEnum[(FlagsEnum["Deptgynecology"] = "deptgynecology")] = "Deptgynecology"
    FlagsEnum[(FlagsEnum["Deptpediatry"] = "deptpediatry")] = "Deptpediatry"
    FlagsEnum[(FlagsEnum["Deptalgology"] = "deptalgology")] = "Deptalgology"
    FlagsEnum[(FlagsEnum["Deptanatomopathology"] = "deptanatomopathology")] = "Deptanatomopathology"
    FlagsEnum[(FlagsEnum["Deptanesthesiology"] = "deptanesthesiology")] = "Deptanesthesiology"
    FlagsEnum[(FlagsEnum["Deptbacteriology"] = "deptbacteriology")] = "Deptbacteriology"
    FlagsEnum[(FlagsEnum["Deptcardiacsurgery"] = "deptcardiacsurgery")] = "Deptcardiacsurgery"
    FlagsEnum[(FlagsEnum["Deptcardiology"] = "deptcardiology")] = "Deptcardiology"
    FlagsEnum[
      (FlagsEnum["Deptchildandadolescentpsychiatry"] = "deptchildandadolescentpsychiatry")
    ] =
      "Deptchildandadolescentpsychiatry"
    FlagsEnum[(FlagsEnum["Deptdermatology"] = "deptdermatology")] = "Deptdermatology"
    FlagsEnum[(FlagsEnum["Deptdiabetology"] = "deptdiabetology")] = "Deptdiabetology"
    FlagsEnum[(FlagsEnum["Deptemergency"] = "deptemergency")] = "Deptemergency"
    FlagsEnum[(FlagsEnum["Deptendocrinology"] = "deptendocrinology")] = "Deptendocrinology"
    FlagsEnum[(FlagsEnum["Deptgastroenterology"] = "deptgastroenterology")] = "Deptgastroenterology"
    FlagsEnum[(FlagsEnum["Deptgenetics"] = "deptgenetics")] = "Deptgenetics"
    FlagsEnum[(FlagsEnum["Deptgeriatry"] = "deptgeriatry")] = "Deptgeriatry"
    FlagsEnum[(FlagsEnum["Depthandsurgery"] = "depthandsurgery")] = "Depthandsurgery"
    FlagsEnum[(FlagsEnum["Depthematology"] = "depthematology")] = "Depthematology"
    FlagsEnum[(FlagsEnum["Deptinfectiousdisease"] = "deptinfectiousdisease")] =
      "Deptinfectiousdisease"
    FlagsEnum[(FlagsEnum["Deptintensivecare"] = "deptintensivecare")] = "Deptintensivecare"
    FlagsEnum[(FlagsEnum["Deptlaboratory"] = "deptlaboratory")] = "Deptlaboratory"
    FlagsEnum[(FlagsEnum["Deptmajorburns"] = "deptmajorburns")] = "Deptmajorburns"
    FlagsEnum[(FlagsEnum["Deptmaxillofacialsurgery"] = "deptmaxillofacialsurgery")] =
      "Deptmaxillofacialsurgery"
    FlagsEnum[(FlagsEnum["Deptmedicine"] = "deptmedicine")] = "Deptmedicine"
    FlagsEnum[(FlagsEnum["Deptmolecularbiology"] = "deptmolecularbiology")] = "Deptmolecularbiology"
    FlagsEnum[(FlagsEnum["Deptneonatalogy"] = "deptneonatalogy")] = "Deptneonatalogy"
    FlagsEnum[(FlagsEnum["Deptnephrology"] = "deptnephrology")] = "Deptnephrology"
    FlagsEnum[(FlagsEnum["Deptneurology"] = "deptneurology")] = "Deptneurology"
    FlagsEnum[(FlagsEnum["Deptneurosurgery"] = "deptneurosurgery")] = "Deptneurosurgery"
    FlagsEnum[(FlagsEnum["Deptnte"] = "deptnte")] = "Deptnte"
    FlagsEnum[(FlagsEnum["Deptnuclear"] = "deptnuclear")] = "Deptnuclear"
    FlagsEnum[(FlagsEnum["Deptnutritiondietetics"] = "deptnutritiondietetics")] =
      "Deptnutritiondietetics"
    FlagsEnum[(FlagsEnum["Deptobstetrics"] = "deptobstetrics")] = "Deptobstetrics"
    FlagsEnum[(FlagsEnum["Deptoncology"] = "deptoncology")] = "Deptoncology"
    FlagsEnum[(FlagsEnum["Deptophtalmology"] = "deptophtalmology")] = "Deptophtalmology"
    FlagsEnum[(FlagsEnum["Deptorthopedy"] = "deptorthopedy")] = "Deptorthopedy"
    FlagsEnum[(FlagsEnum["Deptpalliativecare"] = "deptpalliativecare")] = "Deptpalliativecare"
    FlagsEnum[(FlagsEnum["Deptpediatricintensivecare"] = "deptpediatricintensivecare")] =
      "Deptpediatricintensivecare"
    FlagsEnum[(FlagsEnum["Deptpediatricsurgery"] = "deptpediatricsurgery")] = "Deptpediatricsurgery"
    FlagsEnum[(FlagsEnum["Deptpharmacy"] = "deptpharmacy")] = "Deptpharmacy"
    FlagsEnum[(FlagsEnum["Deptphysicalmedecine"] = "deptphysicalmedecine")] = "Deptphysicalmedecine"
    FlagsEnum[(FlagsEnum["Deptphysiotherapy"] = "deptphysiotherapy")] = "Deptphysiotherapy"
    FlagsEnum[(FlagsEnum["Deptplasticandreparatorysurgery"] = "deptplasticandreparatorysurgery")] =
      "Deptplasticandreparatorysurgery"
    FlagsEnum[(FlagsEnum["Deptpneumology"] = "deptpneumology")] = "Deptpneumology"
    FlagsEnum[(FlagsEnum["Deptpodiatry"] = "deptpodiatry")] = "Deptpodiatry"
    FlagsEnum[(FlagsEnum["Deptpsychiatry"] = "deptpsychiatry")] = "Deptpsychiatry"
    FlagsEnum[(FlagsEnum["Deptradiology"] = "deptradiology")] = "Deptradiology"
    FlagsEnum[(FlagsEnum["Deptradiotherapy"] = "deptradiotherapy")] = "Deptradiotherapy"
    FlagsEnum[(FlagsEnum["Deptrevalidation"] = "deptrevalidation")] = "Deptrevalidation"
    FlagsEnum[(FlagsEnum["Deptrheumatology"] = "deptrheumatology")] = "Deptrheumatology"
    FlagsEnum[(FlagsEnum["Deptrhumatology"] = "deptrhumatology")] = "Deptrhumatology"
    FlagsEnum[(FlagsEnum["Deptsenology"] = "deptsenology")] = "Deptsenology"
    FlagsEnum[(FlagsEnum["Deptsocialservice"] = "deptsocialservice")] = "Deptsocialservice"
    FlagsEnum[(FlagsEnum["Deptsportsmedecine"] = "deptsportsmedecine")] = "Deptsportsmedecine"
    FlagsEnum[(FlagsEnum["Deptstomatology"] = "deptstomatology")] = "Deptstomatology"
    FlagsEnum[(FlagsEnum["Deptsurgery"] = "deptsurgery")] = "Deptsurgery"
    FlagsEnum[(FlagsEnum["Deptthoracicsurgery"] = "deptthoracicsurgery")] = "Deptthoracicsurgery"
    FlagsEnum[(FlagsEnum["Depttoxicology"] = "depttoxicology")] = "Depttoxicology"
    FlagsEnum[(FlagsEnum["Depttropicalmedecine"] = "depttropicalmedecine")] = "Depttropicalmedecine"
    FlagsEnum[(FlagsEnum["Depturology"] = "depturology")] = "Depturology"
    FlagsEnum[(FlagsEnum["Deptvascularsurgery"] = "deptvascularsurgery")] = "Deptvascularsurgery"
    FlagsEnum[
      (FlagsEnum["Deptvisceraldigestiveabdominalsurgery"] = "deptvisceraldigestiveabdominalsurgery")
    ] =
      "Deptvisceraldigestiveabdominalsurgery"
    FlagsEnum[(FlagsEnum["Depttransplantsurgery"] = "depttransplantsurgery")] =
      "Depttransplantsurgery"
    FlagsEnum[(FlagsEnum["Deptpercutaneous"] = "deptpercutaneous")] = "Deptpercutaneous"
    FlagsEnum[(FlagsEnum["Deptchildbirth"] = "deptchildbirth")] = "Deptchildbirth"
  })((FlagsEnum = CodeDto.FlagsEnum || (CodeDto.FlagsEnum = {})))
})((CodeDto = exports.CodeDto || (exports.CodeDto = {})))
//# sourceMappingURL=CodeDto.js.map
