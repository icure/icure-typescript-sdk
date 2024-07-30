import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'
import { AbstractFilterDevice } from '../../icc-api/model/AbstractFilterDevice'

export class ExternalViewFilterDevice extends AbstractFilterDevice {
  $type: string = 'ExternalViewFilter'
  entityQualifiedName: string = 'org.taktik.icure.entities.Device'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterDevice, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
