import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyMonthTagPrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyMonthTagPrefixFilter' = 'ServiceByHcPartyMonthTagPrefixFilter'
  constructor(base: {
    healthcarePartyId: string
    year: number | undefined
    month: number | undefined
    tagType: string
    tagCodePrefix: string
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.year = base.year
    this.month = base.month
    this.tagType = base.tagType
    this.tagCodePrefix = base.tagCodePrefix
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  year: number | undefined
  month: number | undefined
  tagType: string
  tagCodePrefix: string
  startValueDate: number | undefined
  endValueDate: number | undefined
}
