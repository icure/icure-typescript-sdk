import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyPatientCodePrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyPatientCodePrefixFilter' = 'ServiceByHcPartyPatientCodePrefixFilter'
  constructor(base: {
    healthcarePartyId: string
    patientSecretForeignKeys: string[]
    codeType: string
    codeCodePrefix: string
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.patientSecretForeignKeys = base.patientSecretForeignKeys
    this.codeType = base.codeType
    this.codeCodePrefix = base.codeCodePrefix
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  patientSecretForeignKeys: string[]
  codeType: string
  codeCodePrefix: string
  startValueDate: number | undefined
  endValueDate: number | undefined
}
