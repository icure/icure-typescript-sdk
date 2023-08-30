import {AbstractFilterTopic} from "../../icc-api/model/AbstractFilterTopic";

export class TopicByHcPartyFilter extends AbstractFilterTopic {
    $type: string = 'TopicByHcPartyFilter'
    constructor(json: JSON | any) {
        super(json)

        Object.assign(this as TopicByHcPartyFilter, json)
    }

    hcpId?: string
    desc?: string
}
