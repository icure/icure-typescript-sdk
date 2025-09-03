import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyMonthCodePrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyMonthCodePrefixFilter' = 'ServiceByHcPartyMonthCodePrefixFilter'
  constructor(base: {
    healthcarePartyId: string
    year: number | undefined
    month: number | undefined
    codeType: string
    codeCodePrefix: string
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.year = base.year
    this.month = base.month
    this.codeType = base.codeType
    this.codeCodePrefix = base.codeCodePrefix
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  year: number | undefined
  month: number | undefined
  codeType: string
  codeCodePrefix: string
  startValueDate: number | undefined
  endValueDate: number | undefined
}
