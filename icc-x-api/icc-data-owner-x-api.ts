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
  private dataOwnerCache: { [key: string]: Promise<DataOwnerWithType> } = {}
  private selfDataOwnerId: string | undefined

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
   * If the logged user is a data owner get the current data owner.
   * @throws if the current user is not a data owner.
   */
  async getCurrentDataOwner(): Promise<DataOwnerWithType> {
    // TODO endpoint to save request for user? In case remember to check for integrity
    if (!this.selfDataOwnerId) {
      this.selfDataOwnerId = this.getDataOwnerOf(await this.userBaseApi.getCurrentUser())
    }
    return this.getDataOwner(this.selfDataOwnerId)
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
    return (
      this.dataOwnerCache[ownerId] ??
      (loadIfMissingFromCache
        ? (this.dataOwnerCache[ownerId] = this.patientBaseApi
            .getPatient(ownerId)
            .then((patient) => ({ type: 'patient', dataOwner: patient } as DataOwnerWithType))
            .catch(async () => ({ type: 'device', dataOwner: await this.deviceBaseApi.getDevice(ownerId) } as DataOwnerWithType))
            .catch(async () => ({ type: 'hcp', dataOwner: await this.hcpartyBaseApi.getHealthcareParty(ownerId) } as DataOwnerWithType))
            .then((dataOwnerWithType) => {
              if (dataOwnerWithType.dataOwner.id == this.selfDataOwnerId) this.checkDataOwnerIntegrity(dataOwnerWithType.dataOwner)
              return dataOwnerWithType
            })
            .catch((e) => {
              delete this.dataOwnerCache[ownerId]
              throw e
            }))
        : undefined)
    )
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
   * @internal This method is intended only for internal use and may be changed without notice.
   * Clears the cache for a data owner, should be called after every update to the data owner entity so that {@link getDataOwner} will always provide
   * the updated values.
   * @param dataOwnerId id of the updated data owner.
   */
  clearCachedDataOwner(dataOwnerId: string) {
    // TODO in some situations we may already replace with the updated patient promise.
    delete this.dataOwnerCache[dataOwnerId]
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
    return ownerType === 'hcp'
      ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.hcpartyBaseApi
          .modifyHealthcareParty(ownerToUpdate as HealthcareParty)
          .then((x) => ({ type: 'hcp', dataOwner: x } as DataOwnerWithType)))
      : ownerType === 'patient'
      ? await (this.dataOwnerCache[ownerToUpdate.id!] = this.patientBaseApi
          .modifyPatient(ownerToUpdate as Patient)
          .then((x) => ({ type: 'patient', dataOwner: x } as DataOwnerWithType)))
      : await (this.dataOwnerCache[ownerToUpdate.id!] = this.deviceBaseApi
          .updateDevice(ownerToUpdate as Device)
          .then((x) => ({ type: 'device', dataOwner: x } as DataOwnerWithType)))
  }

  private checkDataOwnerIntegrity(dataOwner: DataOwner) {
    const keys = this.getHexPublicKeysOf(dataOwner)
    if (new Set(Array.from(keys).map((x) => x.slice(-32))).size != keys.size) {
      throw `Different public keys for ${dataOwner.id} have the same fingerprint; this should not happen in normal circumstances. Please report this error to iCure.`
    }
  }
}
