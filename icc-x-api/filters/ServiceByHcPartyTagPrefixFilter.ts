import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyTagPrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyTagPrefixFilter' = 'ServiceByHcPartyTagPrefixFilter'
  constructor(base: {
    healthcarePartyId: string
    tagType: string
    tagCodePrefix: string
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.tagType = base.tagType
    this.tagCodePrefix = base.tagCodePrefix
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  tagType: string
  tagCodePrefix: string
  startValueDate: number | undefined
  endValueDate: number | undefined
}
