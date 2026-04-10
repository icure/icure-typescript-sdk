import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyTagCodesFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyTagCodesFilter' = 'ServiceByHcPartyTagCodesFilter'
  constructor(base: {
    healthcarePartyId: string
    tagCodes: Record<string, string[]>
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.tagCodes = base.tagCodes
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  tagCodes: Record<string, string[]>
  startValueDate: number | undefined
  endValueDate: number | undefined
}