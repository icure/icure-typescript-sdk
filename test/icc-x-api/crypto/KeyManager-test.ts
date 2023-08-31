import { v4 as uuid } from 'uuid'
import { User } from '../../../icc-api/model/User'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { BasicAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage } from '../../utils/test_utils'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { IcureApi, KeyPair } from '../../../icc-x-api'
import exp = require('constants')
import { KeyManager } from '../../../icc-x-api/crypto/KeyManager'
import { TestApi } from '../../utils/TestApi'
import { ua2hex } from '@icure/apiV6'

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
        pairs: [{ privateKey: apis.grandCredentials.privateKey, publicKey: apis.grandCredentials.publicKey }],
      },
      {
        dataOwnerId: apis.childCredentials.dataOwnerId,
        pairs: [{ privateKey: apis.childCredentials.privateKey, publicKey: apis.childCredentials.publicKey }],
      },
    ])
    const cryptoStrats = new TestCryptoStrategies(
      undefined,
      {},
      {
        [apis.parentCredentials.dataOwnerId]: { privateKey: apis.parentCredentials.privateKey, publicKey: apis.parentCredentials.publicKey },
      }
    )
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
        pairs: [{ privateKey: apis.grandCredentials.privateKey, publicKey: apis.grandCredentials.publicKey }],
      },
      {
        dataOwnerId: apis.parentCredentials.dataOwnerId,
        pairs: [{ privateKey: apis.parentCredentials.privateKey, publicKey: apis.parentCredentials.publicKey }],
      },
      {
        dataOwnerId: apis.childCredentials.dataOwnerId,
        pairs: [{ privateKey: apis.childCredentials.privateKey, publicKey: apis.childCredentials.publicKey }],
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
})
