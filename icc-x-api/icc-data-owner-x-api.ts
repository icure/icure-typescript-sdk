import { User } from '../icc-api/model/User'
import { IccPatientApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { HealthcareParty } from '../icc-api/model/HealthcareParty'
import { Delegation } from '../icc-api/model/Delegation'

export class IccDataOwnerXApi {
  crypto: IccCryptoXApi
  private patientBaseApi: IccPatientApi

  constructor(crypto: IccCryptoXApi, patientBaseApi: IccPatientApi) {
    this.crypto = crypto
    this.patientBaseApi = patientBaseApi
  }

  getDataOwnerOf(user: User): string {
    const dataOwnerId = user.healthcarePartyId ?? user.patientId ?? user.deviceId
    if (dataOwnerId == undefined) {
      throw Error(`User ${user.id} is not a data owner`)
    }
    return dataOwnerId
  }
}
