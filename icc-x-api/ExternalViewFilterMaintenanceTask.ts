import { AbstractFilterMaintenanceTask } from '../icc-api/model/AbstractFilterMaintenanceTask'
import { ExternalFilterKey } from '../icc-api/model/ExternalFilterKey'

export class ExternalViewFilterMaintenanceTask extends AbstractFilterMaintenanceTask {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.MaintenanceTask'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterMaintenanceTask, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
