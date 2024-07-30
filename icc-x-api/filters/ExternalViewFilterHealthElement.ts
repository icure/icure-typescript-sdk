import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'
import { AbstractFilterHealthElement } from '../../icc-api/model/AbstractFilterHealthElement'

export class ExternalViewFilterHealthElement extends AbstractFilterHealthElement {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.HealthElement'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterHealthElement, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
