import { User } from '../icc-api/model/User'
import { HealthcareParty } from '../icc-api/model/HealthcareParty'
import { Patient } from '../icc-api/model/Patient'
import { Device } from '../icc-api/model/Device'
import { hexPublicKeysOf } from './crypto/utils'
import { DataOwnerTypeEnum } from '../icc-api/model/DataOwnerTypeEnum'
import { CryptoActorStub, CryptoActorStubWithType } from '../icc-api/model/CryptoActorStub'
import { IccDataownerApi } from '../icc-api/api/IccDataownerApi'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { DataOwnerWithType } from '../icc-api/model/DataOwnerWithType'

export type DataOwnerOrStub = DataOwner | CryptoActorStub
export type DataOwner = HealthcareParty | Patient | Device

export class IccDataOwnerXApi extends IccDataownerApi {
  private currentDataOwnerType: DataOwnerTypeEnum | undefined
  private currentDataOwnerHierarchyIds: string[] | undefined

  private get selfDataOwnerId(): string | undefined {
    if (!this.currentDataOwnerHierarchyIds) return undefined
    return this.currentDataOwnerHierarchyIds[this.currentDataOwnerHierarchyIds.length - 1]
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
  }

  /**
   * If the logged user is a data owner get the current data owner. This information is cached without expiration, and will only be updated in case
   * of forced refresh.
   * @throws if the current user is not a data owner.
   */
  async getCurrentDataOwnerId(): Promise<string> {
    if (!this.currentDataOwnerHierarchyIds) {
      await this.getCurrentDataOwnerHierarchyIds()
    }
    return this.currentDataOwnerHierarchyIds![this.currentDataOwnerHierarchyIds!.length - 1]
  }

  /**
   * If the logged user is a data owner get its parent hierarchy. This information is cached without expiration, and will only be updated in case
   * of forced refresh.
   * The resulting array starts with the topmost parent (the only ancestor without a parent) and ends with the data owner itself.
   * @throws if the current user is not a data owner.
   */
  async getCurrentDataOwnerHierarchyIds(): Promise<string[]> {
    if (!this.currentDataOwnerHierarchyIds) {
      await this.forceLoadCurrentDataOwnerHierarchyAndCacheIds()
    }
    return [...this.currentDataOwnerHierarchyIds!]
  }

  /**
   * Get the hierarchy for the current data owner starting from the specified parent.
   * @throws an array starting at the topmost parent and ending at the provided parent id. If the provided id is not part of the hierarchy throws an
   * error.
   */
  async getCurrentDataOwnerHierarchyIdsFrom(parentId: string): Promise<string[]> {
    if (!this.currentDataOwnerHierarchyIds) {
      await this.getCurrentDataOwnerHierarchyIds()
    }
    const res = []
    for (const dataOwnerId of this.currentDataOwnerHierarchyIds!) {
      res.push(dataOwnerId)
      if (dataOwnerId === parentId) return res
    }
    throw new Error(`${parentId} is not part of the data owner hierarchy for the current user`)
  }

  /**
   * If the logged user is a data owner get the current data owner and all of his parents.
   * @throws if the current user is not a data owner.
   * @return the current data owner hierarchy, starting from the topmost parent to the current data owner.
   */
  async getCurrentDataOwnerHierarchy(): Promise<DataOwnerWithType[]> {
    if (!this.currentDataOwnerHierarchyIds) {
      return await this.forceLoadCurrentDataOwnerHierarchyAndCacheIds()
    } else return Promise.all(this.currentDataOwnerHierarchyIds!.map((id) => this.getDataOwner(id)))
  }

  /**
   * If the logged user is a data owner get the type of the current data owner. This information is cached.
   * @throws if the current user is not a data owner
   */
  async getCurrentDataOwnerType(): Promise<DataOwnerTypeEnum> {
    if (!this.currentDataOwnerHierarchyIds) {
      await this.forceLoadCurrentDataOwnerHierarchyAndCacheIds()
    }
    return this.currentDataOwnerType!
  }

  /**
   * Get the id of the data owner entity for a user.
   * @param user a user that is also a data owner.
   * @return the id of the data owner corresponding to the provided user.
   * @throws if the user is not a data owner.
   */
  getDataOwnerIdOf(user: User): string {
    const dataOwnerId = user.healthcarePartyId ?? user.patientId ?? user.deviceId
    if (dataOwnerId == undefined) {
      throw Error(`User ${user.id} is not a data owner`)
    }
    return dataOwnerId
  }

  /**
   * Get a data owner. Note that this does not decrpyt patient data owners.
   * @param ownerId id of the data owner to retrieve (patient, medical device, hcp, ...)
   * @return the data owner with the provided id
   * @throws if you have no access to the data owner. Use {@link getCryptoActorStub}.
   */
  async getDataOwner(ownerId: string): Promise<DataOwnerWithType> {
    return super.getDataOwner(ownerId).then((dowt) => {
      if (dowt.dataOwner.id === this.selfDataOwnerId) this.checkDataOwnerIntegrity(dowt.dataOwner)
      return dowt
    })
  }

  /**
   * Get a crypto actor stub for a data owner.
   * @param ownerId id of the data owner for which you want to retrieve the stub (patient, medical device, hcp, ...)
   * @return the crypto actor stub of the data owner with the provided id
   */
  async getCryptoActorStub(ownerId: string): Promise<CryptoActorStubWithType> {
    return super.getCryptoActorStub(ownerId).then((dowt) => {
      if (dowt.stub.id === this.selfDataOwnerId) this.checkDataOwnerIntegrity(dowt.stub)
      return dowt
    })
  }

  /**
   * Gets the public keys of a data owner in hex format.
   * @param dataOwner a data owner.
   * @return the public keys for the data owner in hex format.
   */
  getHexPublicKeysOf(dataOwner: DataOwnerOrStub): Set<string> {
    return hexPublicKeysOf(dataOwner)
  }

  /**
   * Clears the cache of current data owner id and parent hierarchy ids. The hierarchy of a data owner should not normally change over time, so this
   * method should be rarely needed.
   */
  clearCurrentDataOwnerIdsCache() {
    this.currentDataOwnerHierarchyIds = undefined
  }

  private checkDataOwnerIntegrity(dataOwner: DataOwnerOrStub) {
    const keys = this.getHexPublicKeysOf(dataOwner)
    if (new Set(Array.from(keys).map((x) => x.slice(-32))).size != keys.size)
      throw new Error(
        `Different public keys for ${dataOwner.id} have the same fingerprint; this should not happen in normal circumstances. Please report this error to iCure.`
      )
  }

  private async forceLoadCurrentDataOwnerHierarchyAndCacheIds(): Promise<DataOwnerWithType[]> {
    let curr = await this.getCurrentDataOwner()
    this.checkDataOwnerIntegrity(curr.dataOwner)
    this.currentDataOwnerType = curr.type
    let res = [curr]
    while ((curr.dataOwner as HealthcareParty).parentId) {
      curr = await this.getDataOwner((curr.dataOwner as HealthcareParty).parentId!)
      res = [curr, ...res]
    }
    this.currentDataOwnerHierarchyIds = res.map((x) => x.dataOwner.id!)
    return res
  }
}
