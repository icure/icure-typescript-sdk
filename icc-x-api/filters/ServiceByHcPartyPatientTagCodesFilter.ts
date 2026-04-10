import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyPatientTagCodesFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyPatientTagCodesFilter' = 'ServiceByHcPartyPatientTagCodesFilter'
  constructor(base: {
    healthcarePartyId: string
    patientSecretForeignKeys: string[]
    tagCodes: Record<string, string[]>
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.patientSecretForeignKeys = base.patientSecretForeignKeys
    this.tagCodes = base.tagCodes
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  patientSecretForeignKeys: string[]
  tagCodes: Record<string, string[]>
  startValueDate: number | undefined
  endValueDate: number | undefined
}