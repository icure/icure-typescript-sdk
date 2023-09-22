import {AbstractFilterTopic} from "../../icc-api/model/AbstractFilterTopic";

export class TopicByParticipantFilter extends AbstractFilterTopic {
    $type: string = 'TopicByParticipantFilter'
    constructor(json: JSON | any) {
        super(json)

        Object.assign(this as TopicByParticipantFilter, json)
    }

    participantId?: string
    desc?: string
}
