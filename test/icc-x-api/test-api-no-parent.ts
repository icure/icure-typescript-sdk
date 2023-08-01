import { before } from 'mocha'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { Apis, hex2ua, IcureApi } from '../../icc-x-api'
import { User } from '../../icc-api/model/User'
import initApi = TestUtils.initApi
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { webcrypto } from 'crypto'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
chaiUse(require('chai-as-promised'))

setLocalStorage(fetch)
let env: TestVars
let api: Apis
let user: User
let login: string
let keypair: KeyPair<CryptoKey>

describe('A user without access to parent data', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    const initialisationApi = await initApi(env, hcp1Username)
    const initialisationUser = await initialisationApi.userApi.getCurrentUser()
    const childHcp = await initialisationApi.healthcarePartyApi.createHealthcareParty({
      id: initialisationApi.cryptoApi.primitives.randomUuid(),
      name: 'Some hcp',
      parentId: initialisationUser.healthcarePartyId,
    })
    login = `childUser-${initialisationApi.cryptoApi.primitives.randomUuid()}`
    const childUser = await initialisationApi.userApi.createUser({
      id: initialisationApi.cryptoApi.primitives.randomUuid(),
      healthcarePartyId: childHcp.id,
      login,
      passwordHash: 'LetMeInForReal',
    })
    keypair = await initialisationApi.cryptoApi.primitives.RSA.generateKeyPair()
    api = await IcureApi.initialise(
      env.iCureUrl,
      { username: childUser.login!, password: 'LetMeInForReal' },
      new TestCryptoStrategies(keypair),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
        disableParentKeysInitialisation: true,
      }
    )
    user = await api.userApi.getCurrentUser()
  })

  it('should not be able to initialise the api without disabling parent keys initialisation', async () => {
    await expect(
      IcureApi.initialise(env.iCureUrl, { username: login, password: 'LetMeInForReal' }, new TestCryptoStrategies(keypair), webcrypto as any, fetch, {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      })
    ).to.be.rejected
  })

  it('should still be able to create and retrieve his data', async () => {
    const patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, {
        firstName: 'Tasty',
        lastName: 'Test',
        note: 'Secret',
      })
    )
    expect(patient.note).to.equal('Secret')
    const he = await api.healthcareElementApi.createHealthElementWithUser(
      user,
      await api.healthcareElementApi.newInstance(user, patient, {
        note: 'Secret 2',
      })
    )
    expect(he.note).to.equal('Secret 2')
    expect(he.secretForeignKeys).to.have.length(1)
    expect(he.secretForeignKeys).to.have.members(await api.patientApi.decryptSecretIdsOf(patient))
  })
})
