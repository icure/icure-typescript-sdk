import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { CryptoPrimitives, CryptoStrategies, IcureApi, KeyPair, ShaVersion, ua2hex } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import * as chaiAsPromised from 'chai-as-promised'
import { fingerprintV1 } from '../../icc-x-api/crypto/utils'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../utils/TestStorage'
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

class VerifySelfKeyStrategy implements CryptoStrategies {
  constructor(private readonly selfPub: string) {}

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
    expect(keysData.every((x) => x.unavailableKeys.length == 0)).to.be.true
    expect(keysData[1].unknownKeys).to.have.length(1)
    expect(keysData[1].unknownKeys[0]).to.eq(this.selfPub)
    return {
      [keysData[0].dataOwner.dataOwner.id!]: {
        recoveredKeys: {},
        keyAuthenticity: {},
      },
      [keysData[1].dataOwner.dataOwner.id!]: {
        recoveredKeys: {},
        keyAuthenticity: { [fingerprintV1(this.selfPub)]: true },
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

  async function init() {
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
    return {
      childCredentials,
      selfKeyPub,
      parentKey: initialKeys.parents[0].keys[0].pair,
      parentCredentials,
    }
  }

  async function checkKeys(api: IcureApi, expectedSelfKey: string) {
    const recoveredKeys = await api.cryptoApi.getEncryptionDecryptionKeypairsForDataOwnerHierarchy()
    expect(recoveredKeys.self.keys).to.have.length(1)
    expect(recoveredKeys.self.keys[0].verified).to.eq(true)
    expect(recoveredKeys.parents).to.have.length(1)
    expect(recoveredKeys.parents[0].keys).to.have.length(1)
    expect(recoveredKeys.parents[0].keys[0].verified).to.eq(true)
    expect(ua2hex(await api.cryptoApi.primitives.RSA.exportKey(recoveredKeys.self.keys[0].pair.publicKey, 'spki'))).to.eq(expectedSelfKey)
  }

  it('Sdk should be able to use recovery data accessible with parent key to recover key of user - parent key recovered by crypto strategies', async function () {
    const { childCredentials, selfKeyPub, parentKey } = await init()
    const apiWithLostKey = await IcureApi.initialise(
      env.iCureUrl,
      { username: childCredentials.user, password: childCredentials.password },
      new RecoverParentKeyVerifySelfKeyStrategy(parentKey, selfKeyPub),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    await checkKeys(apiWithLostKey, selfKeyPub)
  })

  it('Sdk should be able to use recovery data accessible with parent key to recover key of user - parent key available in storage', async function () {
    const { childCredentials, selfKeyPub, parentCredentials } = await init()
    const storageWithParentKey = await testStorageWithKeys([
      {
        dataOwnerId: parentCredentials.dataOwnerId!,
        pairs: [
          {
            keyPair: { privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey },
            shaVersion: ShaVersion.Sha1,
          },
        ],
      },
    ])
    const apiWithLostKey = await IcureApi.initialise(
      env.iCureUrl,
      { username: childCredentials.user, password: childCredentials.password },
      new VerifySelfKeyStrategy(selfKeyPub),
      webcrypto as any,
      fetch,
      {
        storage: storageWithParentKey.storage,
        keyStorage: storageWithParentKey.keyStorage,
        entryKeysFactory: storageWithParentKey.keyFactory,
      }
    )
    await checkKeys(apiWithLostKey, selfKeyPub)
  })
})
