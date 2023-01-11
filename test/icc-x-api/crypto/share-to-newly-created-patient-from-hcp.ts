import { Api, hex2ua, IccCryptoXApi, pkcs8ToJwk, retry, spkiToJwk, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { HealthcareParty, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { BasicAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import { createHcpHierarchyApis, getEnvironmentInitializer, getEnvVariables, setLocalStorage, TestVars } from '../../utils/test_utils'
import { TestKeyStorage, TestStorage } from '../../utils/TestStorage'
import { DefaultStorageEntryKeysFactory } from '../../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'

setLocalStorage(fetch)

const AS_PORT = 16044

const privateKeys = {} as Record<string, Record<string, string>>
let hcpUser: User | undefined = undefined
let delegateHcp: HealthcareParty | undefined = undefined

async function makeKeyPair(cryptoApi: IccCryptoXApi, login: string) {
  const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
  privateKeys[login] = { [publicKeyHex]: ua2hex((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer) }
  return publicKeyHex
}

async function getApiAndAddPrivateKeysForUser(u: User) {
  const api = await Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'LetMeInForReal', webcrypto as unknown as Crypto, fetch)
  await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
    await p
    await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
  }, Promise.resolve())
  return api
}

let env: TestVars | undefined

describe('Full battery of tests on crypto and keys', async function () {
  this.timeout(600000)

  before(async function () {
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it(`Share patient from hcp to patient`, async () => {
    const { childApi: api, childUser: u } = await createHcpHierarchyApis(env!)

    const patient = await api.patientApi.createPatientWithUser(
      u,
      await api.patientApi.newInstance(u, { id: uuid(), firstName: 'test', lastName: 'test', note: 'secure' })
    )
    const check = await api.patientApi.getPatientWithUser(u, patient.id)

    expect(check.note).to.equal('secure')

    const newPatientUser = await api.userApi.createUser(
      new User({
        id: `user-${patient.id}-patient`,
        login: `patient-${patient.id}`,
        status: 'ACTIVE',
        passwordHash: 'LetMeInForReal',
        patientId: patient.id,
      })
    )

    const apiAsPatient = await Api(
      env!.iCureUrl,
      newPatientUser.login!,
      'LetMeInForReal',
      webcrypto as unknown as Crypto,
      fetch,
      true,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      new DefaultStorageEntryKeysFactory(),
      new TestCryptoStrategies(await api.cryptoApi.primitives.RSA.generateKeyPair())
    )

    const patientBaseApi = new IccPatientApi(env!.iCureUrl, {}, new BasicAuthenticationProvider(newPatientUser.login!, 'LetMeInForReal'))

    const pat = await patientBaseApi.getPatient(patient.id)

    expect(pat.note ?? undefined).to.be.undefined

    await api.patientApi.share(u, patient.id, u.healthcarePartyId!, [patient.id], { [patient.id]: ['all'] })

    await apiAsPatient.cryptoApi.forceReload(true)
    const entity = await apiAsPatient.patientApi.getPatientWithUser(await apiAsPatient.userApi.getCurrentUser(), patient.id)

    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null
    expect(entity.note).to.equal('secure')
  })
})
