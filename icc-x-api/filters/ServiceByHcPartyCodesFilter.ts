import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyCodesFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyCodesFilter' = 'ServiceByHcPartyCodesFilter'
  constructor(base: {
    healthcarePartyId: string
    codeCodes: Record<string, string[]>
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.codeCodes = base.codeCodes
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  codeCodes: Record<string, string[]>
  startValueDate: number | undefined
  endValueDate: number | undefined
}