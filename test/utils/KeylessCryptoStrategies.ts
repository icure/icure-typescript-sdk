import { CryptoPrimitives, CryptoStrategies, KeyPair } from '../../icc-x-api'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'

export class KeylessCryptoStrategies implements CryptoStrategies {
  requestedKey: boolean = false

  dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
    return dataOwner.type != DataOwnerTypeEnum.Hcp
  }

  generateNewKeyForDataOwner(): Promise<KeyPair<CryptoKey> | boolean | 'keyless'> {
    this.requestedKey = true
    return Promise.resolve('keyless')
  }

  recoverAndVerifySelfHierarchyKeys(
    keysData: {
      dataOwner: DataOwnerWithType
      unknownKeys: string[]
      unavailableKeys: string[]
    }[]
  ): Promise<{
    [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
  }> {
    const res: {
      [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
    } = {}
    keysData.forEach((x) => (res[x.dataOwner.dataOwner.id!] = { recoveredKeys: {}, keyAuthenticity: {} }))
    return Promise.resolve(res)
  }

  verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }
}
