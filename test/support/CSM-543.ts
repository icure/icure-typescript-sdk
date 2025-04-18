import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../utils/test_utils'
import { CryptoPrimitives, CryptoStrategies, IcureApi, KeyPair, ua2hex } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import * as chaiAsPromised from 'chai-as-promised'
import { fingerprintV1 } from '../../icc-x-api/crypto/utils'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { KeyPairRecoverer } from '../../icc-x-api/crypto/KeyPairRecoverer'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { DataOwnerTypeEnum } from '../../icc-api/model/DataOwnerTypeEnum'

setLocalStorage(fetch)

chaiUse(chaiAsPromised)

let env: TestVars

class RecoverParentKeyVerifySelfKeyStrategy implements CryptoStrategies {
  constructor(private readonly parentKeys: KeyPair<CryptoKey>, private readonly selfPub: string) {}

  dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
    return dataOwner.type != DataOwnerTypeEnum.Hcp
  }

  generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean | 'keyless'> {
    return Promise.resolve(false)
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: {
      dataOwner: DataOwnerWithType
      unknownKeys: string[]
      unavailableKeys: string[]
    }[],
    cryptoPrimitives: CryptoPrimitives,
    keyPairRecoverer: KeyPairRecoverer
  ): Promise<{
    [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
  }> {
    expect(keysData).to.have.length(2)
    return {
      [keysData[0].dataOwner.dataOwner.id!]: {
        recoveredKeys: {
          [fingerprintV1(ua2hex(await cryptoPrimitives.RSA.exportKey(this.parentKeys.publicKey, 'spki')))]: this.parentKeys,
        },
        keyAuthenticity: {},
      },
      [keysData[1].dataOwner.dataOwner.id!]: {
        recoveredKeys: {},
        keyAuthenticity: {
          [fingerprintV1(this.selfPub)]: true,
        },
      },
    }
  }

  verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }
}

describe('CSM-543', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Sdk should be able to use recovery data accessible with parent key to recover key of user', async function () {
    const {
      grandUser: parentUser,
      grandApi: parentApi,
      grandCredentials: parentCredentials,
      parentUser: childUser,
      parentApi: childApi,
      parentCredentials: childCredentials,
    } = await createHcpHierarchyApis(env)
    const initialKeys = await childApi.cryptoApi.getEncryptionDecryptionKeypairsForDataOwnerHierarchy()
    expect(initialKeys.self.keys).to.have.length(1)
    expect(initialKeys.self.keys[0].verified).to.eq(true)
    expect(initialKeys.parents).to.have.length(1)
    expect(initialKeys.parents[0].keys).to.have.length(1)
    expect(initialKeys.parents[0].keys[0].verified).to.eq(true)
    const selfKeyPub = ua2hex(await childApi.cryptoApi.primitives.RSA.exportKey(initialKeys.self.keys[0].pair.publicKey, 'spki'))
    await childApi.cryptoApi.shamirKeysManager.updateSelfSplits(
      { [fingerprintV1(selfKeyPub)]: { notariesIds: [parentCredentials.dataOwnerId], minShares: 1 } },
      []
    )
    const apiWithLostKey = await IcureApi.initialise(
      env.iCureUrl,
      { username: childCredentials.user, password: childCredentials.password },
      new RecoverParentKeyVerifySelfKeyStrategy(initialKeys.parents[0].keys[0].pair, selfKeyPub),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    const recoveredKeys = await apiWithLostKey.cryptoApi.getEncryptionDecryptionKeypairsForDataOwnerHierarchy()
    expect(recoveredKeys.self.keys).to.have.length(1)
    expect(recoveredKeys.self.keys[0].verified).to.eq(true)
    expect(recoveredKeys.parents).to.have.length(1)
    expect(recoveredKeys.parents[0].keys).to.have.length(1)
    expect(recoveredKeys.parents[0].keys[0].verified).to.eq(true)
    expect(ua2hex(await childApi.cryptoApi.primitives.RSA.exportKey(recoveredKeys.self.keys[0].pair.publicKey, 'spki'))).to.eq(selfKeyPub)
  })
})
