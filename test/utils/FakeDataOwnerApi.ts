import { DataOwner, DataOwnerTypeEnum, DataOwnerWithType, IccDataOwnerXApi } from '../../icc-x-api/icc-data-owner-x-api'
import { FakeGenericApi } from './FakeGenericApi'
import { Patient } from '../../icc-api/model/Patient'
import { Device } from '../../icc-api/model/Device'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'
import { ua2hex } from '../../icc-x-api'

export class FakeDataOwnerApi extends IccDataOwnerXApi {
  private readonly selfId: string
  private readonly data = new FakeGenericApi<DataOwner & { type: DataOwnerTypeEnum }>()
  private readonly primitives = new CryptoPrimitives(webcrypto as any)

  constructor(self: DataOwner & { type: DataOwnerTypeEnum }, others: (DataOwner & { type: DataOwnerTypeEnum })[] = []) {
    super(null as any, null as any, null as any, null as any)
    this.selfId = self.id!
    this.data.createObject(self)
    others.forEach((x) => this.data.createObject(x))
  }

  async getCurrentDataOwnerId(): Promise<string> {
    return this.selfId
  }

  async getCurrentDataOwnerHierarchyIds(): Promise<string[]> {
    let res = [this.selfId]
    let latestCheck = this.data.getById(this.selfId)
    while (latestCheck && (latestCheck as any).parentId) {
      const currId: string = (latestCheck as any).parentId
      latestCheck = this.data.getById(currId)!
      res = [currId, ...res]
    }
    return res
  }

  async getCurrentDataOwnerHierarchyIdsFrom(parentId: string): Promise<string[]> {
    const res = []
    for (const dataOwnerId of await this.getCurrentDataOwnerHierarchyIds()) {
      res.push(dataOwnerId)
      if (dataOwnerId === parentId) return res
    }
    throw new Error(`${parentId} is not part of the data owner hierarchy for the current user`)
  }

  async getCurrentDataOwner(): Promise<DataOwnerWithType> {
    return this.mapObject(this.data.getById(this.selfId)!)
  }

  async getCurrentDataOwnerHierarchy(): Promise<DataOwnerWithType[]> {
    return (await this.getCurrentDataOwnerHierarchyIds()).map((id) => this.mapObject(this.data.getById(id)!))
  }

  async getCurrentDataOwnerType(): Promise<DataOwnerTypeEnum> {
    return this.data.getById(this.selfId)!.type
  }

  async getDataOwner(ownerId: string): Promise<DataOwnerWithType> {
    return this.mapObject(this.data.getById(ownerId)!)
  }

  async updateDataOwner(dataOwner: DataOwnerWithType): Promise<DataOwnerWithType> {
    if (this.data.getById(dataOwner.dataOwner.id!)?.type !== dataOwner.type) throw new Error('Unexpected type for data owner.')
    return this.mapObject(this.data.modifyObject({ ...dataOwner.dataOwner, type: dataOwner.type }))
  }

  async addPublicKeyForOwner(dataOwnerId: string, keyPair: KeyPair<CryptoKey>) {
    const retrieved = await this.getDataOwner(dataOwnerId)
    const publicHex = ua2hex(await this.primitives.RSA.exportKey(keyPair.publicKey, 'spki'))
    await this.updateDataOwner(
      this.mapObject({
        ...retrieved.dataOwner,
        aesExchangeKeys: {
          ...(retrieved.dataOwner.aesExchangeKeys ?? {}),
          [publicHex]: retrieved.dataOwner.aesExchangeKeys?.[publicHex] ?? {},
        },
        type: retrieved.type,
      })
    )
  }

  private mapObject(x: DataOwner & { type: DataOwnerTypeEnum }): DataOwnerWithType {
    const type = x.type
    delete (x as any).type
    return IccDataOwnerXApi.instantiateDataOwnerWithType(x, type)
  }
}
