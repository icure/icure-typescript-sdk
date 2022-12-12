import { User } from '../icc-api/model/User'
import { IccDeviceApi, IccHcpartyApi, IccPatientApi, IccUserApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { HealthcareParty } from '../icc-api/model/HealthcareParty'
import { Delegation } from '../icc-api/model/Delegation'
import { Patient } from '../icc-api/model/Patient'
import { Device } from '../icc-api/model/Device'
import { IccUserXApi } from './icc-user-x-api'
import { hexPublicKeysOf } from './crypto/utils'

/**
 * Represents any data owner enriched with type information.
 */
export type DataOwnerWithType =
  | { type: 'patient'; dataOwner: Patient }
  | { type: 'device'; dataOwner: Device }
  | { type: 'hcp'; dataOwner: HealthcareParty }

/**
 * Represents any data owner.
 */
export type DataOwner = Patient | Device | HealthcareParty

export class IccDataOwnerXApi {
  private userBaseApi: IccUserApi
  private hcpartyBaseApi: IccHcpartyApi
  private patientBaseApi: IccPatientApi
  private deviceBaseApi: IccDeviceApi
  private selfDataOwnerId: string | undefined
  private currentDataOwnerHierarchyIds: string[] | undefined

  constructor(
    userBaseApi: IccUserApi,
    hcpartyBaseApi: IccHcpartyApi, //Init with a hcparty x api for better performances
    patientBaseApi: IccPatientApi,
    deviceBaseApi: IccDeviceApi
  ) {
    this.userBaseApi = userBaseApi
    this.hcpartyBaseApi = hcpartyBaseApi
    this.patientBaseApi = patientBaseApi
    this.deviceBaseApi = deviceBaseApi
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
   * If the logged user is a data owner get the current data owner.
   * @throws if the current user is not a data owner.
   */
  async getCurrentDataOwner(): Promise<DataOwnerWithType> {
    if (!this.currentDataOwnerHierarchyIds) {
      const dataOwnerHierarchy = await this.forceLoadCurrentDataOwnerHierarchyAndCacheIds()
      return dataOwnerHierarchy[dataOwnerHierarchy.length - 1]
    } else return this.getDataOwner(await this.getCurrentDataOwnerId())
  }

  /**
   * Get the id of the data owner entity for a user.
   * @param user a user that is also a data owner.
   * @return the id of the data owner corresponding to the provided user.
   * @throws if the user is not a data owner.
   */
  getDataOwnerOf(user: User): string {
    const dataOwnerId = user.healthcarePartyId ?? user.patientId ?? user.deviceId
    if (dataOwnerId == undefined) {
      throw Error(`User ${user.id} is not a data owner`)
    }
    return dataOwnerId
  }

  /**
   * Get a data owner. Uses a cache to improve performance.
   * @param ownerId id of the data owner to retrieve (patient, medical device, hcp, ...)
   * @param loadIfMissingFromCache if true and the data owner is not in cache will start a job to retrieve it, if false will instead return undefined
   * @return the data owner or undefined if loadIfMissingFromCache is false and there is no data owner with provided id in cache.
   * @throws if no data owner with the provided id could be found on an error occurred while attempting to retrieve it.
   */
  getDataOwner(ownerId: string, loadIfMissingFromCache: boolean = true): Promise<DataOwnerWithType> {
    // TODO Data owner endpoint to save some requests?
    return this.patientBaseApi
      .getPatient(ownerId)
      .then((patient) => ({ type: 'patient', dataOwner: patient } as DataOwnerWithType))
      .catch(async () => ({ type: 'device', dataOwner: await this.deviceBaseApi.getDevice(ownerId) } as DataOwnerWithType))
      .catch(async () => ({ type: 'hcp', dataOwner: await this.hcpartyBaseApi.getHealthcareParty(ownerId) } as DataOwnerWithType))
      .then((dataOwnerWithType) => {
        if (dataOwnerWithType.dataOwner.id == this.selfDataOwnerId) this.checkDataOwnerIntegrity(dataOwnerWithType.dataOwner)
        return dataOwnerWithType
      })
  }

  /**
   * Gets the public keys of a data owner in hex format.
   * @param dataOwner a data owner.
   * @return the public keys for the data owner in hex format.
   */
  getHexPublicKeysOf(dataOwner: DataOwner): Set<string> {
    return hexPublicKeysOf(dataOwner)
  }

  /**
   * Clears the cache of current data owner id and parent hierarchy ids. The hierarchy of a data owner should not normally change over time, so this
   * method should be rarely needed.
   */
  clearCurrentDataOwnerIdsCache() {
    this.currentDataOwnerHierarchyIds = undefined
  }

  /**
   * @internal This method is intended only for internal use and may be changed without notice.
   * Updates a data owner and its cached value.
   * @param dataOwner a data owner with updated value.
   * @return the updated data owner, with updated revision.
   */
  async updateDataOwner(dataOwner: DataOwnerWithType): Promise<DataOwnerWithType> {
    const ownerType = dataOwner.type
    const ownerToUpdate = dataOwner.dataOwner
    if (ownerType === 'hcp') {
      return await this.hcpartyBaseApi
        .modifyHealthcareParty(ownerToUpdate as HealthcareParty)
        .then((x) => ({ type: 'hcp', dataOwner: x } as DataOwnerWithType))
    } else if (ownerType === 'patient') {
      return await this.patientBaseApi.modifyPatient(ownerToUpdate as Patient).then((x) => ({ type: 'patient', dataOwner: x } as DataOwnerWithType))
    } else if (ownerType === 'device') {
      return await this.deviceBaseApi.updateDevice(ownerToUpdate as Device).then((x) => ({ type: 'device', dataOwner: x } as DataOwnerWithType))
    } else throw new Error(`Unrecognised data owner type: ${ownerType}`)
  }

  private checkDataOwnerIntegrity(dataOwner: DataOwner) {
    const keys = this.getHexPublicKeysOf(dataOwner)
    if (new Set(Array.from(keys).map((x) => x.slice(-32))).size != keys.size)
      throw new Error(
        `Different public keys for ${dataOwner.id} have the same fingerprint; this should not happen in normal circumstances. Please report this error to iCure.`
      )
  }

  private async forceLoadCurrentDataOwnerHierarchyAndCacheIds(): Promise<DataOwnerWithType[]> {
    const currentUser = await this.userBaseApi.getCurrentUser()
    let curr = await this.getDataOwner(this.getDataOwnerOf(currentUser))
    let res = [curr]
    while ((curr.dataOwner as HealthcareParty).parentId) {
      curr = await this.getDataOwner((curr.dataOwner as HealthcareParty).parentId!)
      res = [curr, ...res]
    }
    return res
  }
}
