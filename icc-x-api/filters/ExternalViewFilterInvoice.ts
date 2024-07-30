import { ExternalFilterKey } from '../../icc-api/model/ExternalFilterKey'
import { AbstractFilterInvoice } from '../../icc-api/model/AbstractFilterInvoice'

export class ExternalViewFilterInvoice extends AbstractFilterInvoice {
  $type: string = 'ExternalViewFilterDto'
  entityQualifiedName: string = 'org.taktik.icure.entities.Invoice'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as ExternalViewFilterInvoice, json)
  }

  view?: string
  partition?: string
  startKey?: ExternalFilterKey
  endKey?: ExternalFilterKey
  desc?: string
}
