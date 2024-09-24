import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterService extends AbstractFilterService {
  $type: string = 'ExternalViewFilter'
  entityQualifiedName: string = 'org.taktik.icure.entities.embed.Service'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterService, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
