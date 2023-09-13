/*
 * Copyright (c) 2020. Taktik SA, All rights reserved.
 */
import { AbstractFilterPatient } from '../../icc-api/model/AbstractFilterPatient'
import { Patient } from '../../icc-api/model/Patient'
import GenderEnum = Patient.GenderEnum

export class PatientByHcPartyGenderEducationProfessionFilter extends AbstractFilterPatient {
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as PatientByHcPartyGenderEducationProfessionFilter, json)

  }

  healthcarePartyId?: string
  gender?: GenderEnum
  education?: string
  profession?: string
  desc?: string

  $type = 'PatientByHcPartyGenderEducationProfession' // Named according to the Kotlin class name in kraken-refactor without filter at the end
}
