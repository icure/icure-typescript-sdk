import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyTagPrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyTagPrefixFilter' = 'ServiceByHcPartyTagPrefixFilter'
  constructor(base: { healthcarePartyId: string; tagType: string; tagCodePrefix: string; desc?: string }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.tagType = base.tagType
    this.tagCodePrefix = base.tagCodePrefix
  }

  desc: string | undefined
  healthcarePartyId: string
  tagType: string
  tagCodePrefix: string
}
