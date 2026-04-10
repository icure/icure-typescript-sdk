import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyPatientCodesFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyPatientCodesFilter' = 'ServiceByHcPartyPatientCodesFilter'
  constructor(base: {
    healthcarePartyId: string
    patientSecretForeignKeys: string[]
    codeCodes: Record<string, string[]>
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.patientSecretForeignKeys = base.patientSecretForeignKeys
    this.codeCodes = base.codeCodes
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  patientSecretForeignKeys: string[]
  codeCodes: Record<string, string[]>
  startValueDate: number | undefined
  endValueDate: number | undefined
}