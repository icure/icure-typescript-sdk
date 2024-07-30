import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterPatient extends AbstractFilterPatient {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.Patient'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterPatient, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
