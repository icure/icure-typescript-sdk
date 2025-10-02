import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyCodePrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyCodePrefixFilter' = 'ServiceByHcPartyCodePrefixFilter'
  constructor(base: { healthcarePartyId: string; codeType: string; codeCodePrefix: string; desc?: string }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.codeType = base.codeType
    this.codeCodePrefix = base.codeCodePrefix
  }

  desc: string | undefined
  healthcarePartyId: string
  codeType: string
  codeCodePrefix: string
}
