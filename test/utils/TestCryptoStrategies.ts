import { CryptoStrategies } from '../../icc-x-api/crypto/CryptoStrategies'
import { KeyPair, RSAUtils, RSAUtilsImpl, ShaVersion } from '../../icc-x-api/crypto/RSA'
import { hexPublicKeysWithSha1Of, hexPublicKeysWithSha256Of } from '../../icc-x-api/crypto/utils'
import { webcrypto } from 'crypto'
import { CryptoPrimitives, hex2ua, ua2hex } from '../../icc-x-api'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'

export class TestCryptoStrategies implements CryptoStrategies {
  private readonly RSA = new RSAUtilsImpl(webcrypto as any)
  recoverAndVerifyCallsParams: Array<{ dataOwner: DataOwnerWithType; unknownKeys: string[]; unavailableKeys: string[] }[]> = []

  constructor(
    private readonly keyPair?: KeyPair<CryptoKey>,
    private readonly verifiedSelfKeys: { [p: string]: boolean } = {},
    private readonly limitVerifiedDelegatesKeys?: Set<string>,
    private readonly recoveredParentKeys: { [parentId: string]: { pair: KeyPair<string>; shaVersion: ShaVersion } } = {}
  ) {}

  async generateNewKeyForDataOwner(self: DataOwnerWithType): Promise<KeyPair<CryptoKey> | boolean> {
    if (!this.keyPair) return false
    const knownKeys = new Set([...hexPublicKeysWithSha1Of(self), ...hexPublicKeysWithSha256Of(self)])
    const publicKey = ua2hex(await this.RSA.exportKey(this.keyPair.publicKey, 'spki'))
    return knownKeys.has(publicKey) ? false : this.keyPair
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: { dataOwner: DataOwnerWithType; unknownKeys: string[]; unavailableKeys: string[] }[],
    cryptoPrimitives: CryptoPrimitives
  ): Promise<{ [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } } }> {
    this.recoverAndVerifyCallsParams.push(keysData)
    const self = keysData[keysData.length - 1].dataOwner
    const knownKeys = new Set([...hexPublicKeysWithSha1Of(self.dataOwner), ...hexPublicKeysWithSha256Of(self.dataOwner)])
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
                      [recoveredKey.pair.publicKey.slice(-32)]: await cryptoPrimitives.RSA.importKeyPair(
                        'pkcs8',
                        hex2ua(recoveredKey.pair.privateKey),
                        'spki',
                        hex2ua(recoveredKey.pair.publicKey),
                        recoveredKey.shaVersion
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
    if (this.limitVerifiedDelegatesKeys) {
      return Promise.resolve(publicKeys.filter((x) => this.limitVerifiedDelegatesKeys!.has(x)))
    } else return Promise.resolve(publicKeys)
  }

  dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
    return dataOwner.type !== 'hcp'
  }
}
