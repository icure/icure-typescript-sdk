import { CryptoStrategies } from '../../icc-x-api/crypto/CryptoStrategies'
import { KeyPair, RSAUtils } from '../../icc-x-api/crypto/RSA'
import { DataOwner } from '../../icc-x-api/icc-data-owner-x-api'
import { hexPublicKeysOf } from '../../icc-x-api/crypto/utils'
import { webcrypto } from 'crypto'
import { CryptoPrimitives, hex2ua, ua2hex } from '../../icc-x-api'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'

export class TestCryptoStrategies implements CryptoStrategies {
  private readonly keyPair: KeyPair<CryptoKey> | undefined
  private readonly verifiedSelfKeys: { [p: string]: boolean }
  private readonly RSA = new RSAUtils(webcrypto as any)
  recoverAndVerifyCallsParams: Array<{ dataOwner: DataOwnerWithType; unknownKeys: string[]; unavailableKeys: string[] }[]> = []

  constructor(
    keyPair?: KeyPair<CryptoKey>,
    verifiedSelfKeys: { [p: string]: boolean } = {},
    private readonly recoveredParentKeys: { [parentId: string]: KeyPair<string> } = {}
  ) {
    this.keyPair = keyPair
    this.verifiedSelfKeys = verifiedSelfKeys
  }

  async generateNewKeyForDataOwner(self: DataOwnerWithType): Promise<KeyPair<CryptoKey> | boolean> {
    if (!this.keyPair) return false
    const knownKeys = hexPublicKeysOf(self.dataOwner)
    const publicKey = ua2hex(await this.RSA.exportKey(this.keyPair.publicKey, 'spki'))
    return knownKeys.has(publicKey) ? false : this.keyPair
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: { dataOwner: DataOwnerWithType; unknownKeys: string[]; unavailableKeys: string[] }[],
    cryptoPrimitives: CryptoPrimitives
  ): Promise<{ [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } } }> {
    this.recoverAndVerifyCallsParams.push(keysData)
    const self = keysData[keysData.length - 1].dataOwner
    const knownKeys = hexPublicKeysOf(self.dataOwner)
    const publicKey = this.keyPair ? ua2hex(await this.RSA.exportKey(this.keyPair.publicKey, 'spki')) : undefined
    return Object.fromEntries(
      await Promise.all(
        keysData.map(async (currData) => {
          if (currData.dataOwner.dataOwner.id! !== self.dataOwner.id!) {
            const recoveredKey = this.recoveredParentKeys[currData.dataOwner.dataOwner.id!]
            return [
              currData.dataOwner.dataOwner.id!,
              {
                recoveredKeys: recoveredKey
                  ? {
                      [recoveredKey.publicKey.slice(-32)]: await cryptoPrimitives.RSA.importKeyPair(
                        'pkcs8',
                        hex2ua(recoveredKey.privateKey),
                        'spki',
                        hex2ua(recoveredKey.publicKey)
                      ),
                    }
                  : {},
                keyAuthenticity: {},
              },
            ]
          } else if (publicKey === undefined || !knownKeys.has(publicKey)) {
            return [currData.dataOwner.dataOwner.id!, { recoveredKeys: {}, keyAuthenticity: this.verifiedSelfKeys }]
          } else {
            return [
              currData.dataOwner.dataOwner.id!,
              { recoveredKeys: { [publicKey.slice(-32)]: this.keyPair }, keyAuthenticity: this.verifiedSelfKeys },
            ]
          }
        })
      )
    )
  }

  verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[]): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }
}
