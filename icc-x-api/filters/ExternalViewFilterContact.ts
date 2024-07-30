import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'
import { AbstractFilterContact } from '../../icc-api/model/AbstractFilterContact'

export class ExternalViewFilterContact extends AbstractFilterContact {
  $type: string = 'ExternalViewFilter'
  entityQualifiedName: string = 'org.taktik.icure.entities.Contact'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterContact, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
