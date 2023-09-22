import {AbstractFilterMessage} from "../../icc-api/model/AbstractFilterMessage";

export class MessageByHcPartyFilter extends AbstractFilterMessage {
    $type: string = 'MessageByHcPartyFilter'
    constructor(json: JSON | any) {
        super(json)

        Object.assign(this as MessageByHcPartyFilter, json)
    }

    hcpId?: string
    desc?: string
}
