import { Patient, Insurability } from '../../icc-api/model/models'

export function isBIM(ct1: number | string, ct2: number | string): boolean {
  //BIM if ct1 ood and ct2 ood
  return +ct1 % 2 !== 0 && +ct2 % 2 !== 0
}

export function patientIsBIM(patient: Patient) {
  // FIXME this doesn't check the date of the insurability. It is related to the idea of having only on insurability at a time.
  return isBIM(patient?.insurabilities?.[0]?.parameters?.tc1 ?? '000', patient?.insurabilities?.[0]?.parameters?.tc2 ?? '000')
}

export function isPatientPaymentByIo(patient: Patient) {
  const paymentByIo = patient?.insurabilities?.[0]?.parameters?.paymentByIo
  return paymentByIo === 'true'
}

/**
 * Returns the titulary id from patient insurability
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export function getMembership(patient: Patient): string {
  const ioCode = patient?.insurabilities?.[0]?.identificationNumber
  if (ioCode === undefined) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return ioCode
}

/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient The patient
 */
export function getInsurability(patient: Patient): Insurability {
  const insurability = patient?.insurabilities?.[0]
  if (insurability === undefined) {
    // TODO translate
    throw new Error("Le patient n'a pas de données d'assurabilité")
  }
  return insurability
}

/**
 * Returns the insurability from patient
 * @throws error if the patient has no insurability data
 * @param patient
 */
export function isPatientHospitalized(patient: Patient): boolean {
  return getInsurability(patient).hospitalisation || false
}
