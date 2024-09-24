import { AbstractFilterTopic } from '../../icc-api/model/AbstractFilterTopic'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterTopic extends AbstractFilterTopic {
  $type: string = 'ExternalViewFilter'
  entityQualifiedName: string = 'org.taktik.icure.entities.Topic'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterTopic, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
