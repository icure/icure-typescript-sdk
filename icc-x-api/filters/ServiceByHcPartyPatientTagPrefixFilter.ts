import { AbstractFilterService } from '../../icc-api/model/AbstractFilterService'

export class ServiceByHcPartyPatientTagPrefixFilter extends AbstractFilterService {
  readonly $type: 'ServiceByHcPartyPatientTagPrefixFilter' = 'ServiceByHcPartyPatientTagPrefixFilter'
  constructor(base: {
    healthcarePartyId: string
    patientSecretForeignKeys: string[]
    tagType: string
    tagCodePrefix: string
    startValueDate?: number
    endValueDate?: number
    desc?: string
  }) {
    super({ desc: base.desc })
    this.healthcarePartyId = base.healthcarePartyId
    this.patientSecretForeignKeys = base.patientSecretForeignKeys
    this.tagType = base.tagType
    this.tagCodePrefix = base.tagCodePrefix
    this.startValueDate = base.startValueDate
    this.endValueDate = base.endValueDate
  }

  desc: string | undefined
  healthcarePartyId: string
  patientSecretForeignKeys: string[]
  tagType: string
  tagCodePrefix: string
  startValueDate: number | undefined
  endValueDate: number | undefined
}
