import { AbstractFilterUser } from '../../icc-api/model/AbstractFilterUser'
import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterUser extends AbstractFilterUser {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.User'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterUser, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
