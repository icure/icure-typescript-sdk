import { AbstractFilterMessage } from '../../icc-api/model/AbstractFilterMessage'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterMessage extends AbstractFilterMessage {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.Message'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterMessage, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
