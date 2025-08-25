import { AbstractFilterMessage } from '../../icc-api/model/AbstractFilterMessage'

export class MessageByDataOwnerTransportGuidSentDateFilter extends AbstractFilterMessage {
  $type: string = 'MessageByDataOwnerTransportGuidSentDateFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as MessageByDataOwnerTransportGuidSentDateFilter, json)
  }

  dataOwnerId?: string
  transportGuid?: string
  fromDate?: number
  toDate?: number
  descending?: boolean
  desc?: string
}
