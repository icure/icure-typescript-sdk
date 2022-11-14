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

  private async _hasAccessTo(dataOwnerId: string, delegations: { [key: string]: Array<Delegation> }): Promise<boolean> {
    return this.crypto.getDataOwner(dataOwnerId).then(({ dataOwner: dataOwner }) => {
      const parentId = (dataOwner as HealthcareParty).parentId
      if (!dataOwner.id || !delegations[dataOwner.id] || !delegations[dataOwner.id].length) {
        return !!parentId ? this._hasAccessTo(parentId, delegations) : false
      }
      return true
    })
  }

  async hasAccessTo(dataOwner: User, delegations: { [key: string]: Array<Delegation> }): Promise<boolean> {
    return this._hasAccessTo(this.getDataOwnerOf(dataOwner), delegations)
  }
}
