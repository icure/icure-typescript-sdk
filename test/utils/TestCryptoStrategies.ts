import { CryptoStrategies } from '../../icc-x-api/crypto/CryptoStrategies'
import { KeyPair, RSAUtils } from '../../icc-x-api/crypto/RSA'
import { DataOwner, DataOwnerTypeEnum, DataOwnerWithType } from '../../icc-x-api/icc-data-owner-x-api'
import { hexPublicKeysOf } from '../../icc-x-api/crypto/utils'
import { webcrypto } from 'crypto'
import { ua2hex } from '../../icc-x-api'

export class TestCryptoStrategies implements CryptoStrategies {
  private readonly keyPair: KeyPair<CryptoKey> | undefined
  private readonly verifiedSelfKeys: { [p: string]: boolean }
  private readonly RSA = new RSAUtils(webcrypto as any)

  constructor(keyPair?: KeyPair<CryptoKey>, verifiedSelfKeys: { [p: string]: boolean } = {}) {
    this.keyPair = keyPair
    this.verifiedSelfKeys = verifiedSelfKeys
  }

  async generateNewKeyForDataOwner(self: DataOwner): Promise<KeyPair<CryptoKey> | boolean> {
    if (!this.keyPair) return false
    const knownKeys = hexPublicKeysOf(self)
    const publicKey = ua2hex(await this.RSA.exportKey(this.keyPair.publicKey, 'spki'))
    return knownKeys.has(publicKey) ? false : this.keyPair
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: { dataOwner: DataOwner; unknownKeys: string[]; unavailableKeys: string[] }[]
  ): Promise<{ [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } } }> {
    const self = keysData[keysData.length - 1].dataOwner
    const knownKeys = hexPublicKeysOf(self)
    const publicKey = this.keyPair ? ua2hex(await this.RSA.exportKey(this.keyPair.publicKey, 'spki')) : undefined
    return Object.fromEntries(
      await Promise.all(
        keysData.map(async (currData) => {
          if (currData.dataOwner.id !== self.id) {
            return [currData.dataOwner.id, { recoveredKeys: {}, keyAuthenticity: {} }]
          } else if (publicKey === undefined || !knownKeys.has(publicKey)) {
            return [currData.dataOwner.id, { recoveredKeys: {}, keyAuthenticity: this.verifiedSelfKeys }]
          } else {
            return [currData.dataOwner.id, { recoveredKeys: { [publicKey.slice(-32)]: this.keyPair }, keyAuthenticity: this.verifiedSelfKeys }]
          }
        })
      )
    )
  }

  verifyDelegatePublicKeys(delegate: DataOwner, publicKeys: string[]): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }

  dataOwnerRequiresAnonymousDelegation(dataOwner: DataOwnerWithType): boolean {
    return dataOwner.type !== DataOwnerTypeEnum.Hcp
  }

  dataOwnerCanRequestAllHisExchangeData(dataOwner: DataOwnerWithType): boolean {
    return this.dataOwnerRequiresAnonymousDelegation(dataOwner)
  }
}
