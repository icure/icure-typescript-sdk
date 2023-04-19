import { User } from '../icc-api/model/User'
import { IccDeviceApi, IccPatientApi, IccUserApi } from '../icc-api'
import { HealthcareParty } from '../icc-api/model/HealthcareParty'
import { Patient } from '../icc-api/model/Patient'
import { Device } from '../icc-api/model/Device'
import { hexPublicKeysOf } from './crypto/utils'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { XHR } from '../icc-api/api/XHR'

/**
 * Represents a type of data owner.
 */
export type DataOwnerTypeEnum = 'patient' | 'device' | 'hcp'
export const DataOwnerTypeEnum = {
  Patient: 'patient' as DataOwnerTypeEnum,
  Device: 'device' as DataOwnerTypeEnum,
  Hcp: 'hcp' as DataOwnerTypeEnum,
}

/**
 * Represents any data owner.
 */
export type DataOwner = Patient | Device | HealthcareParty

/**
 * Represents any data owner enriched with type information.
 */
export type DataOwnerWithType = { type: DataOwnerTypeEnum; dataOwner: DataOwner }

export class IccDataOwnerXApi {
  private readonly userBaseApi: IccUserApi
  private readonly hcpartyBaseApi: IccHcpartyXApi
  private readonly patientBaseApi: IccPatientApi
  private readonly deviceBaseApi: IccDeviceApi
  private currentDataOwnerType: DataOwnerTypeEnum | undefined
  private currentDataOwnerHierarchyIds: string[] | undefined

  private get selfDataOwnerId(): string | undefined {
    if (!this.currentDataOwnerHierarchyIds) return undefined
    return this.currentDataOwnerHierarchyIds[this.currentDataOwnerHierarchyIds.length - 1]
  }

  constructor(
    userBaseApi: IccUserApi,
    hcpartyBaseApi: IccHcpartyXApi, //Init with a hcparty x api for better performances
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
   * @return an array starting at the topmost parent and ending at the provided parent id.
   * @throws if the provided id is not part of the hierarchy.
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
   * Get a data owner. Uses a cache to improve performance.
   * @param ownerId id of the data owner to retrieve (patient, medical device, hcp, ...)
   * @return the data owner or undefined if loadIfMissingFromCache is false and there is no data owner with provided id in cache.
   * @throws if no data owner with the provided id could be found on an error occurred while attempting to retrieve it.
   */
  async getDataOwner(ownerId: string): Promise<DataOwnerWithType> {
    const _url = this.userBaseApi.host + `/dataowner/` + ownerId + '?ts=' + new Date().getTime()
    let headers = this.userBaseApi.headers
    return XHR.sendCommand(
      'GET',
      _url,
      headers,
      null,
      this.userBaseApi.fetchImpl,
      undefined,
      this.userBaseApi.authenticationProvider.getAuthService()
    )
      .then((doc) => doc.body as DataOwnerWithType)
      .then((dowt) => {
        if (dowt.dataOwner.id === this.selfDataOwnerId) this.checkDataOwnerIntegrity(dowt.dataOwner)
        return dowt
      })
      .catch((err) => this.handleError(err))
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

  /**
   * @internal This method is for internal use only and may be changed without notice
   */
  static instantiateDataOwnerWithType(dataOwner: any, type: DataOwnerTypeEnum): DataOwnerWithType {
    if (type === DataOwnerTypeEnum.Patient) {
      return { type: DataOwnerTypeEnum.Patient, dataOwner: new Patient(dataOwner) } as DataOwnerWithType
    } else if (type === DataOwnerTypeEnum.Device) {
      return { type: DataOwnerTypeEnum.Device, dataOwner: new Device(dataOwner) } as DataOwnerWithType
    } else if (type === DataOwnerTypeEnum.Hcp) {
      return { type: DataOwnerTypeEnum.Hcp, dataOwner: new HealthcareParty(dataOwner) } as DataOwnerWithType
    } else {
      throw new Error(`Invalid data owner type ${type}`)
    }
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
    let curr = await this.getDataOwner(this.getDataOwnerIdOf(currentUser))
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

  private handleError(e: XHR.XHRError): never {
    throw e
  }
}
