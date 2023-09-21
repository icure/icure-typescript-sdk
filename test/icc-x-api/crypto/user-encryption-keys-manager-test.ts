import { v4 as uuid } from 'uuid'
import { User } from '../../../icc-api/model/User'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { expect } from 'chai'
import { createHcpHierarchyApis, createNewHcpWithoutKeyAndParentWithKey, getEnvironmentInitializer, setLocalStorage } from '../../utils/test_utils'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { CryptoPrimitives, CryptoStrategies, hex2ua, IcureApi, KeyPair } from '../../../icc-x-api'
import { ua2hex } from '@icure/apiV6'
import { DataOwnerWithType } from '../../../icc-api/model/DataOwnerWithType'
import { CryptoActorStubWithType } from '../../../icc-api/model/CryptoActorStub'

setLocalStorage(fetch)

let env: TestVars

describe('Key manager', async function () {
  this.timeout(600000)

  before(async function () {
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it(`Should not ask crypto strategies to recover available keys`, async () => {
    const apis = await createHcpHierarchyApis(env)
    const storageWithoutParentKey = await testStorageWithKeys([
      {
        dataOwnerId: apis.grandCredentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: apis.grandCredentials.privateKey, publicKey: apis.grandCredentials.publicKey }, shaVersion: 'sha-1' }],
      },
      {
        dataOwnerId: apis.childCredentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: apis.childCredentials.privateKey, publicKey: apis.childCredentials.publicKey }, shaVersion: 'sha-1' }],
      },
    ])
    const cryptoStrats = new TestCryptoStrategies(undefined, {}, undefined, {
      [apis.parentCredentials.dataOwnerId]: {
        pair: { privateKey: apis.parentCredentials.privateKey, publicKey: apis.parentCredentials.publicKey },
        shaVersion: 'sha-1',
      },
    })
    await IcureApi.initialise(
      env.iCureUrl,
      { username: apis.childCredentials.user, password: apis.childCredentials.password },
      cryptoStrats,
      webcrypto as any,
      fetch,
      {
        storage: storageWithoutParentKey.storage,
        keyStorage: storageWithoutParentKey.keyStorage,
        entryKeysFactory: storageWithoutParentKey.keyFactory,
      }
    )
    expect(cryptoStrats.recoverAndVerifyCallsParams).to.have.length(1)
    const params = cryptoStrats.recoverAndVerifyCallsParams[0]
    expect(params).to.have.length(3)
    expect(params[0].dataOwner.dataOwner.id).to.equal(apis.grandCredentials.dataOwnerId)
    expect(params[0].unavailableKeys).to.be.empty
    expect(params[0].unknownKeys).to.be.empty
    expect(params[1].dataOwner.dataOwner.id).to.equal(apis.parentCredentials.dataOwnerId)
    expect(params[1].unavailableKeys).to.have.members([apis.parentCredentials.publicKey])
    expect(params[1].unknownKeys).to.have.members([apis.parentCredentials.publicKey])
    expect(params[2].dataOwner.dataOwner.id).to.equal(apis.childCredentials.dataOwnerId)
    expect(params[2].unavailableKeys).to.be.empty
    expect(params[2].unknownKeys).to.be.empty
  })

  it('Should not ask crypto strategies to recover keys if all keys are available', async () => {
    const apis = await createHcpHierarchyApis(env)
    const storageWithoutParentKey = await testStorageWithKeys([
      {
        dataOwnerId: apis.grandCredentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: apis.grandCredentials.privateKey, publicKey: apis.grandCredentials.publicKey }, shaVersion: 'sha-1' }],
      },
      {
        dataOwnerId: apis.parentCredentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: apis.parentCredentials.privateKey, publicKey: apis.parentCredentials.publicKey }, shaVersion: 'sha-1' }],
      },
      {
        dataOwnerId: apis.childCredentials.dataOwnerId,
        pairs: [{ keyPair: { privateKey: apis.childCredentials.privateKey, publicKey: apis.childCredentials.publicKey }, shaVersion: 'sha-1' }],
      },
    ])
    const cryptoStrats = new TestCryptoStrategies()
    await IcureApi.initialise(
      env.iCureUrl,
      { username: apis.childCredentials.user, password: apis.childCredentials.password },
      cryptoStrats,
      webcrypto as any,
      fetch,
      {
        storage: storageWithoutParentKey.storage,
        keyStorage: storageWithoutParentKey.keyStorage,
        entryKeysFactory: storageWithoutParentKey.keyFactory,
      }
    )
    expect(cryptoStrats.recoverAndVerifyCallsParams).to.have.length(0)
  })

  it('Should allow to retrieve all keys for a data owner and his parents', async () => {
    const apis = await createHcpHierarchyApis(env)
    const keysData = await apis.childApi.cryptoApi.getEncryptionDecryptionKeypairsForDataOwnerHierarchy()
    async function checkKey(userDetails: UserDetails, key: KeyPair<CryptoKey>) {
      const exportedPrivateKey = ua2hex(await apis.childApi.cryptoApi.primitives.RSA.exportKey(key.privateKey, 'pkcs8'))
      const exportedPublicKey = ua2hex(await apis.childApi.cryptoApi.primitives.RSA.exportKey(key.publicKey, 'spki'))
      expect(exportedPublicKey).to.equal(userDetails.publicKey)
      expect(exportedPrivateKey).to.equal(userDetails.privateKey)
    }
    expect(keysData.self.dataOwnerId).to.equal(apis.childCredentials.dataOwnerId)
    expect(keysData.self.keys).to.have.length(1)
    expect(keysData.self.keys[0].verified).to.be.true
    await checkKey(apis.childCredentials, keysData.self.keys[0].pair)
    expect(keysData.parents).to.have.length(2)
    expect(keysData.parents[0].dataOwnerId).to.equal(apis.grandCredentials.dataOwnerId)
    expect(keysData.parents[0].keys).to.have.length(1)
    await checkKey(apis.grandCredentials, keysData.parents[0].keys[0].pair)
    expect(keysData.parents[1].dataOwnerId).to.equal(apis.parentCredentials.dataOwnerId)
    expect(keysData.parents[1].keys).to.have.length(1)
    await checkKey(apis.parentCredentials, keysData.parents[1].keys[0].pair)
  })

  it('If a HCP has no key yet, but the parent does the crypto strategies should first ask to recover the keys for the parent then ask for the generation of a new key to the data owner', async () => {
    const hcpsInfo = await createNewHcpWithoutKeyAndParentWithKey(env)
    const cryptoStrats = new (class implements CryptoStrategies {
      generateNewKeyCalled: boolean = false
      recoverCalled: boolean = false
      generatedKeyPair: KeyPair<CryptoKey> | undefined = undefined

      async generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean> {
        if (this.generateNewKeyCalled) throw new Error('generateNewKeyForDataOwner called twice')
        if (!this.recoverCalled) throw new Error('generateNewKeyForDataOwner called before recoverAndVerifySelfHierarchyKeys')
        this.generateNewKeyCalled = true
        expect(self.dataOwner.id).to.equal(hcpsInfo.childDataOwnerId)
        return (this.generatedKeyPair = await cryptoPrimitives.RSA.generateKeyPair('sha-256'))
      }

      async recoverAndVerifySelfHierarchyKeys(
        keysData: {
          dataOwner: DataOwnerWithType
          unknownKeys: string[]
          unavailableKeys: string[]
        }[],
        cryptoPrimitives: CryptoPrimitives
      ): Promise<{
        [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
      }> {
        if (this.recoverCalled) throw new Error('recoverAndVerifySelfHierarchyKeys called twice')
        this.recoverCalled = true
        expect(keysData).to.have.length(2)
        expect(keysData[0].dataOwner.dataOwner.id).to.equal(hcpsInfo.parentCredentials.dataOwnerId)
        expect(keysData[0].unknownKeys).to.have.members([hcpsInfo.parentCredentials.publicKey])
        expect(keysData[0].unavailableKeys).to.have.members([hcpsInfo.parentCredentials.publicKey])
        expect(keysData[1].dataOwner.dataOwner.id).to.equal(hcpsInfo.childDataOwnerId)
        expect(keysData[1].unknownKeys).to.be.empty
        expect(keysData[1].unavailableKeys).to.be.empty
        return {
          [hcpsInfo.parentCredentials.dataOwnerId]: {
            recoveredKeys: {
              [hcpsInfo.parentCredentials.publicKey.slice(-32)]: await cryptoPrimitives.RSA.importKeyPair(
                'pkcs8',
                hex2ua(hcpsInfo.parentCredentials.privateKey),
                'spki',
                hex2ua(hcpsInfo.parentCredentials.publicKey),
                'sha-1'
              ),
            },
            keyAuthenticity: {},
          },
          [hcpsInfo.childDataOwnerId]: {
            recoveredKeys: {},
            keyAuthenticity: {},
          },
        }
      }

      verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
        throw new Error('This method should not be called by this test')
      }

      dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
        return false
      }
    })()
    const childApi = await IcureApi.initialise(
      env.iCureUrl,
      { username: hcpsInfo.childUser, password: hcpsInfo.childPassword },
      cryptoStrats,
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    expect(cryptoStrats.generateNewKeyCalled).to.be.true
    expect(cryptoStrats.recoverCalled).to.be.true
    const keys = Array.from(childApi.dataOwnerApi.getHexPublicKeysOf((await childApi.dataOwnerApi.getCurrentDataOwner()).dataOwner))
    expect(keys).to.have.length(1)
    expect(Array.from(keys)[0]).to.equal(ua2hex(await childApi.cryptoApi.primitives.RSA.exportKey(cryptoStrats.generatedKeyPair!.publicKey, 'spki')))
  })

  it('If a HCP has no key yet, but the parent does and the key is available the crypto strategies should ask for the generation of a new key to the data owner', async () => {
    async function doTest(initialiseEmptyKeyForChild: boolean) {
      const hcpsInfo = await createNewHcpWithoutKeyAndParentWithKey(env, { initialiseEmptyKeyForChild })
      const cryptoStrats = new (class implements CryptoStrategies {
        generateNewKeyCalled: boolean = false
        generatedKeyPair: KeyPair<CryptoKey> | undefined = undefined

        async generateNewKeyForDataOwner(self: DataOwnerWithType, cryptoPrimitives: CryptoPrimitives): Promise<KeyPair<CryptoKey> | boolean> {
          if (this.generateNewKeyCalled) throw new Error('generateNewKeyForDataOwner called twice')
          this.generateNewKeyCalled = true
          expect(self.dataOwner.id).to.equal(hcpsInfo.childDataOwnerId)
          return (this.generatedKeyPair = await cryptoPrimitives.RSA.generateKeyPair('sha-256'))
        }

        async recoverAndVerifySelfHierarchyKeys(
          keysData: {
            dataOwner: DataOwnerWithType
            unknownKeys: string[]
            unavailableKeys: string[]
          }[],
          cryptoPrimitives: CryptoPrimitives
        ): Promise<{
          [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
        }> {
          throw new Error('This method should not be called by this test')
        }

        dataOwnerRequiresAnonymousDelegation(dataOwner: CryptoActorStubWithType): boolean {
          return false
        }

        verifyDelegatePublicKeys(delegate: CryptoActorStubWithType, publicKeys: string[], cryptoPrimitives: CryptoPrimitives): Promise<string[]> {
          throw new Error('This method should not be called by this test')
        }
      })()
      const storages = await testStorageWithKeys([
        {
          dataOwnerId: hcpsInfo.parentCredentials.dataOwnerId,
          pairs: [
            { keyPair: { privateKey: hcpsInfo.parentCredentials.privateKey, publicKey: hcpsInfo.parentCredentials.publicKey }, shaVersion: 'sha-1' },
          ],
        },
      ])
      const childApi = await IcureApi.initialise(
        env.iCureUrl,
        { username: hcpsInfo.childUser, password: hcpsInfo.childPassword },
        cryptoStrats,
        webcrypto as any,
        fetch,
        {
          storage: storages.storage,
          keyStorage: storages.keyStorage,
          entryKeysFactory: storages.keyFactory,
        }
      )
      expect(cryptoStrats.generateNewKeyCalled).to.be.true
      const initialisedHcp = (await childApi.dataOwnerApi.getCurrentDataOwner()).dataOwner
      const keys = Array.from(childApi.dataOwnerApi.getHexPublicKeysOf(initialisedHcp))
      expect(keys).to.have.length(1)
      expect(keys[0]).to.equal(ua2hex(await childApi.cryptoApi.primitives.RSA.exportKey(cryptoStrats.generatedKeyPair!.publicKey, 'spki')))
    }
    await doTest(false)
    await doTest(true)
  })
})
