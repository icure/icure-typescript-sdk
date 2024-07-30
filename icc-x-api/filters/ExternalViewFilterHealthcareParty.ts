import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'
import { AbstractFilterHealthcareParty } from '../../icc-api/model/AbstractFilterHealthcareParty'

export class ExternalViewFilterHealthcareParty extends AbstractFilterHealthcareParty {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.HealthcareParty'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterHealthcareParty, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
