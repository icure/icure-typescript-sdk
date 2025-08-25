import { AbstractFilterMessage } from '../../icc-api/model/AbstractFilterMessage'

export class MessageByHcPartyTransportGuidFilter extends AbstractFilterMessage {
  $type: string = 'MessageByHcPartyTransportGuidFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as MessageByHcPartyTransportGuidFilter, json)
  }

  dataOwnerId?: string
  transportGuid?: string
  fromDate?: number
  toDate?: number
  descending?: boolean
  desc?: string
}
