import {CodeStub} from "./CodeStub"
import {Annotation} from "./Annotation"
import {Range} from "./Range"

/**
 * Reference range for the measure
 *
 * @export
 * @class ReferenceRange
 *
 * @property {number} low lower bound of the reference range (inclusive)
 * @property {number} high upper bound of the reference range (inclusive)
 * @property {CodeStub[]} tags tags giving additional information about the reference range (e.g. applies to children/adults, male/female, etc.)
 * @property {CodeStub[]} codes codes qualifying the reference range using a codification system (e.g. LOINC)
 * @property {Annotation[]} notes notes giving additional information about the reference range
 * @property {Range} age age range to which the reference range applies
 */
export class ReferenceRange {

  constructor(json: JSON | any) {
    this.low = json?.low
    this.high = json?.high
    this.tags = json?.tags?.map((tag: JSON | any) => new CodeStub(tag))
    this.codes = json?.codes?.map((code: JSON | any) => new CodeStub(code))
    this.notes = json?.notes?.map((note: JSON | any) => new Annotation(note))
    this.age = new Range(json?.age)
    this.stringValue = json?.stringValue
  }

  low?: number
  high?: number
  tags?: CodeStub[]
  codes?: CodeStub[]
  notes?: Annotation[]
  age?: Range
  stringValue?: string
}
