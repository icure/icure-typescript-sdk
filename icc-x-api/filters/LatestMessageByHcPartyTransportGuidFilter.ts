import {AbstractFilterMessage} from "../../icc-api/model/AbstractFilterMessage";

export class LatestMessageByHcPartyTransportGuidFilter extends AbstractFilterMessage {
    $type: string = 'LatestMessageByHcPartyTransportGuidFilter'
    constructor(json: JSON | any) {
        super(json)

        Object.assign(this as LatestMessageByHcPartyTransportGuidFilter, json)
    }

    healthcarePartyId?: string
    transportGuid?: string
    desc?: string
}
