import { AbstractFilterCode } from '../../icc-api/model/AbstractFilterCode'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterCode extends AbstractFilterCode {
  $type: string = 'ExternalViewFilter'
  entityQualifiedName: string = 'org.taktik.icure.entities.base.Code'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterCode, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
