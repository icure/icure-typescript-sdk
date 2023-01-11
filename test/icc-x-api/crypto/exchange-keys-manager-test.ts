import 'isomorphic-fetch'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, hcp2Username, setLocalStorage, TestUtils, TestVars } from '../../utils/test_utils'
import initApi = TestUtils.initApi
import { expect } from 'chai'

let env: TestVars
setLocalStorage(fetch)

describe('Exchange keys manager', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should create new encryption keys when necessary and only if necessary', async () => {
    const apis = await initApi(env, hcp1Username)
    const delegateApis = await initApi(env, hcp2Username)
    const selfId = await apis.dataOwnerApi.getCurrentDataOwnerId()
    const delegateId = await delegateApis.dataOwnerApi.getCurrentDataOwnerId()
    const unverifiedKey = await apis.cryptoApi.primitives.AES.generateCryptoKey(false)
    await apis.cryptoApi.exchangeKeys.addFakeKeyTo(delegateId, { key: unverifiedKey, isVerified: false })
    const decryptionKeys1 = await apis.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(selfId, delegateId)
    expect(decryptionKeys1).to.have.length(1)
    expect(decryptionKeys1[0]).to.equal(unverifiedKey)
    const encryptionKeys1 = (await apis.cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(delegateId)).keys
    expect(encryptionKeys1).to.have.length(1)
    expect(encryptionKeys1[0]).to.not.equal(unverifiedKey)
    const decryptionKeys2 = await apis.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(selfId, delegateId)
    expect(decryptionKeys2).to.have.length(2)
    expect(decryptionKeys2).to.include(unverifiedKey)
    expect(decryptionKeys2).to.include(encryptionKeys1[0])
    const encryptionKeys2 = (await apis.cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(delegateId)).keys
    expect(encryptionKeys2).to.have.length(1)
    expect(encryptionKeys2[0]).to.equal(encryptionKeys1[0])
  })
})
