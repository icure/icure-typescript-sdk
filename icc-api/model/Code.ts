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
import { Periodicity } from "./Periodicity"

import { decodeBase64 } from "./ModelHelper"

export class Code {
  constructor(json: JSON | any) {
    Object.assign(this as Code, json)
  }

  id?: string
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  context?: string
  type?: string
  code?: string
  version?: string
  label?: { [key: string]: string }
  author?: string
  regions?: Array<string>
  periodicity?: Array<Periodicity>
  level?: number
  links?: Array<string>
  qualifiedLinks?: { [key: string]: Array<string> }
  flags?: Array<Code.FlagsEnum>
  searchTerms?: { [key: string]: Array<string> }
  data?: string
  appendices?: { [key: string]: string }
  disabled?: boolean
}
export namespace Code {
  export type FlagsEnum =
    | "male_only"
    | "female_only"
    | "deptkinesitherapy"
    | "deptnursing"
    | "deptgeneralpractice"
    | "deptsocialworker"
    | "deptpsychology"
    | "deptadministrative"
    | "deptdietetics"
    | "deptspeechtherapy"
    | "deptdentistry"
    | "deptoccupationaltherapy"
    | "depthealthcare"
    | "deptgynecology"
    | "deptpediatry"
    | "deptalgology"
    | "deptanatomopathology"
    | "deptanesthesiology"
    | "deptbacteriology"
    | "deptcardiacsurgery"
    | "deptcardiology"
    | "deptchildandadolescentpsychiatry"
    | "deptdermatology"
    | "deptdiabetology"
    | "deptemergency"
    | "deptendocrinology"
    | "deptgastroenterology"
    | "deptgenetics"
    | "deptgeriatry"
    | "depthandsurgery"
    | "depthematology"
    | "deptinfectiousdisease"
    | "deptintensivecare"
    | "deptlaboratory"
    | "deptmajorburns"
    | "deptmaxillofacialsurgery"
    | "deptmedicine"
    | "deptmolecularbiology"
    | "deptneonatalogy"
    | "deptnephrology"
    | "deptneurology"
    | "deptneurosurgery"
    | "deptnte"
    | "deptnuclear"
    | "deptnutritiondietetics"
    | "deptobstetrics"
    | "deptoncology"
    | "deptophtalmology"
    | "deptorthopedy"
    | "deptpalliativecare"
    | "deptpediatricintensivecare"
    | "deptpediatricsurgery"
    | "deptpharmacy"
    | "deptphysicalmedecine"
    | "deptphysiotherapy"
    | "deptplasticandreparatorysurgery"
    | "deptpneumology"
    | "deptpodiatry"
    | "deptpsychiatry"
    | "deptradiology"
    | "deptradiotherapy"
    | "deptrevalidation"
    | "deptrheumatology"
    | "deptrhumatology"
    | "deptsenology"
    | "deptsocialservice"
    | "deptsportsmedecine"
    | "deptstomatology"
    | "deptsurgery"
    | "deptthoracicsurgery"
    | "depttoxicology"
    | "depttropicalmedecine"
    | "depturology"
    | "deptvascularsurgery"
    | "deptvisceraldigestiveabdominalsurgery"
    | "depttransplantsurgery"
    | "deptpercutaneous"
    | "deptchildbirth"
  export const FlagsEnum = {
    MaleOnly: "male_only" as FlagsEnum,
    FemaleOnly: "female_only" as FlagsEnum,
    Deptkinesitherapy: "deptkinesitherapy" as FlagsEnum,
    Deptnursing: "deptnursing" as FlagsEnum,
    Deptgeneralpractice: "deptgeneralpractice" as FlagsEnum,
    Deptsocialworker: "deptsocialworker" as FlagsEnum,
    Deptpsychology: "deptpsychology" as FlagsEnum,
    Deptadministrative: "deptadministrative" as FlagsEnum,
    Deptdietetics: "deptdietetics" as FlagsEnum,
    Deptspeechtherapy: "deptspeechtherapy" as FlagsEnum,
    Deptdentistry: "deptdentistry" as FlagsEnum,
    Deptoccupationaltherapy: "deptoccupationaltherapy" as FlagsEnum,
    Depthealthcare: "depthealthcare" as FlagsEnum,
    Deptgynecology: "deptgynecology" as FlagsEnum,
    Deptpediatry: "deptpediatry" as FlagsEnum,
    Deptalgology: "deptalgology" as FlagsEnum,
    Deptanatomopathology: "deptanatomopathology" as FlagsEnum,
    Deptanesthesiology: "deptanesthesiology" as FlagsEnum,
    Deptbacteriology: "deptbacteriology" as FlagsEnum,
    Deptcardiacsurgery: "deptcardiacsurgery" as FlagsEnum,
    Deptcardiology: "deptcardiology" as FlagsEnum,
    Deptchildandadolescentpsychiatry: "deptchildandadolescentpsychiatry" as FlagsEnum,
    Deptdermatology: "deptdermatology" as FlagsEnum,
    Deptdiabetology: "deptdiabetology" as FlagsEnum,
    Deptemergency: "deptemergency" as FlagsEnum,
    Deptendocrinology: "deptendocrinology" as FlagsEnum,
    Deptgastroenterology: "deptgastroenterology" as FlagsEnum,
    Deptgenetics: "deptgenetics" as FlagsEnum,
    Deptgeriatry: "deptgeriatry" as FlagsEnum,
    Depthandsurgery: "depthandsurgery" as FlagsEnum,
    Depthematology: "depthematology" as FlagsEnum,
    Deptinfectiousdisease: "deptinfectiousdisease" as FlagsEnum,
    Deptintensivecare: "deptintensivecare" as FlagsEnum,
    Deptlaboratory: "deptlaboratory" as FlagsEnum,
    Deptmajorburns: "deptmajorburns" as FlagsEnum,
    Deptmaxillofacialsurgery: "deptmaxillofacialsurgery" as FlagsEnum,
    Deptmedicine: "deptmedicine" as FlagsEnum,
    Deptmolecularbiology: "deptmolecularbiology" as FlagsEnum,
    Deptneonatalogy: "deptneonatalogy" as FlagsEnum,
    Deptnephrology: "deptnephrology" as FlagsEnum,
    Deptneurology: "deptneurology" as FlagsEnum,
    Deptneurosurgery: "deptneurosurgery" as FlagsEnum,
    Deptnte: "deptnte" as FlagsEnum,
    Deptnuclear: "deptnuclear" as FlagsEnum,
    Deptnutritiondietetics: "deptnutritiondietetics" as FlagsEnum,
    Deptobstetrics: "deptobstetrics" as FlagsEnum,
    Deptoncology: "deptoncology" as FlagsEnum,
    Deptophtalmology: "deptophtalmology" as FlagsEnum,
    Deptorthopedy: "deptorthopedy" as FlagsEnum,
    Deptpalliativecare: "deptpalliativecare" as FlagsEnum,
    Deptpediatricintensivecare: "deptpediatricintensivecare" as FlagsEnum,
    Deptpediatricsurgery: "deptpediatricsurgery" as FlagsEnum,
    Deptpharmacy: "deptpharmacy" as FlagsEnum,
    Deptphysicalmedecine: "deptphysicalmedecine" as FlagsEnum,
    Deptphysiotherapy: "deptphysiotherapy" as FlagsEnum,
    Deptplasticandreparatorysurgery: "deptplasticandreparatorysurgery" as FlagsEnum,
    Deptpneumology: "deptpneumology" as FlagsEnum,
    Deptpodiatry: "deptpodiatry" as FlagsEnum,
    Deptpsychiatry: "deptpsychiatry" as FlagsEnum,
    Deptradiology: "deptradiology" as FlagsEnum,
    Deptradiotherapy: "deptradiotherapy" as FlagsEnum,
    Deptrevalidation: "deptrevalidation" as FlagsEnum,
    Deptrheumatology: "deptrheumatology" as FlagsEnum,
    Deptrhumatology: "deptrhumatology" as FlagsEnum,
    Deptsenology: "deptsenology" as FlagsEnum,
    Deptsocialservice: "deptsocialservice" as FlagsEnum,
    Deptsportsmedecine: "deptsportsmedecine" as FlagsEnum,
    Deptstomatology: "deptstomatology" as FlagsEnum,
    Deptsurgery: "deptsurgery" as FlagsEnum,
    Deptthoracicsurgery: "deptthoracicsurgery" as FlagsEnum,
    Depttoxicology: "depttoxicology" as FlagsEnum,
    Depttropicalmedecine: "depttropicalmedecine" as FlagsEnum,
    Depturology: "depturology" as FlagsEnum,
    Deptvascularsurgery: "deptvascularsurgery" as FlagsEnum,
    Deptvisceraldigestiveabdominalsurgery: "deptvisceraldigestiveabdominalsurgery" as FlagsEnum,
    Depttransplantsurgery: "depttransplantsurgery" as FlagsEnum,
    Deptpercutaneous: "deptpercutaneous" as FlagsEnum,
    Deptchildbirth: "deptchildbirth" as FlagsEnum
  }
}
