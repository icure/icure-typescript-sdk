import { DataOwner, DataOwnerOrStub, IccDataOwnerXApi } from '../../icc-x-api/icc-data-owner-x-api'
import { FakeGenericApi } from './FakeGenericApi'
import { Patient } from '../../icc-api/model/Patient'
import { Device } from '../../icc-api/model/Device'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { CryptoPrimitives, WebCryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'
import { ua2hex } from '../../icc-x-api'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { User } from '../../icc-api/model/User'

export class FakeDataOwnerApi extends IccDataOwnerXApi {
  private readonly selfId: string
  private readonly data = new FakeGenericApi<DataOwner & { type: DataOwnerTypeEnum }>()
  private readonly primitives = new WebCryptoPrimitives(webcrypto as any)

  constructor(self: DataOwner & { type: DataOwnerTypeEnum }, others: (DataOwner & { type: DataOwnerTypeEnum })[] = []) {
    super('fake', {}, null as any, null as any)
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

  getHexPublicKeysWithSha1Of(dataOwner: DataOwnerOrStub): Set<string> {
    return super.getHexPublicKeysWithSha1Of(dataOwner)
  }

  getHexPublicKeysWithSha256Of(dataOwner: DataOwnerOrStub): Set<string> {
    return super.getHexPublicKeysWithSha256Of(dataOwner)
  }

  async getCurrentDataOwnerStub(): Promise<CryptoActorStubWithType> {
    return CryptoActorStubWithType.fromDataOwner(await this.getCurrentDataOwner())
  }

  getDataOwnerIdOf(user: User): string {
    return super.getDataOwnerIdOf(user)
  }

  async getDataOwner(ownerId: string): Promise<DataOwnerWithType> {
    return this.mapObject(this.data.getById(ownerId)!)
  }

  clearCurrentDataOwnerIdsCache() {
    super.clearCurrentDataOwnerIdsCache()
  }

  async modifyCryptoActorStub(stub: CryptoActorStubWithType): Promise<CryptoActorStubWithType> {
    const existing = this.data.getById(stub.stub.id!)
    if (!existing) throw new Error('Data owner not found.')
    if (existing.type !== stub.type) throw new Error('Unexpected type for data owner.')
    return CryptoActorStubWithType.fromDataOwner(this.mapObject(this.data.modifyObject({ ...existing, ...stub.stub })))
  }

  async getCryptoActorStub(ownerId: string): Promise<CryptoActorStubWithType> {
    return CryptoActorStubWithType.fromDataOwner(await this.getDataOwner(ownerId))
  }

  async addPublicKeyForOwner(dataOwnerId: string, keyPair: KeyPair<CryptoKey>) {
    const retrieved = await this.getCryptoActorStub(dataOwnerId)
    const publicHex = ua2hex(await this.primitives.RSA.exportKey(keyPair.publicKey, 'spki'))
    await this.modifyCryptoActorStub({
      type: retrieved.type,
      stub: {
        ...retrieved.stub,
        publicKeysForOaepWithSha256: [...(retrieved.stub.publicKeysForOaepWithSha256 || []), publicHex],
      },
    })
  }

  private mapObject(x: DataOwner & { type: DataOwnerTypeEnum }): DataOwnerWithType {
    const type = x.type
    delete (x as any).type
    if (type === DataOwnerTypeEnum.Patient) {
      return { type, dataOwner: x as Patient }
    } else if (type === DataOwnerTypeEnum.Device) {
      return { type, dataOwner: x as Device }
    } else if (type === DataOwnerTypeEnum.Hcp) {
      return { type, dataOwner: x as HealthcareParty }
    } else throw new Error('Unexpected type for data owner.')
  }
}
