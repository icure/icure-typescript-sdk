import { Api, hex2ua, IccCryptoXApi, pkcs8ToJwk, retry, spkiToJwk, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { HealthcareParty, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { cleanup } from '@icure/test-setup'
import { BasicAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../../utils/test_utils'
import { crypto } from '../../../node-compat'

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
    this.timeout(300000)

    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())

    const api = await Api(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username].user, env!.dataOwnerDetails[hcp1Username].password, crypto)

    const hcpLogin = `hcp-${uuid()}-delegate`

    const publicKeyDelegate = await makeKeyPair(api.cryptoApi, hcpLogin)
    const publicKeyParent = await makeKeyPair(api.cryptoApi, `hcp-parent`)

    const parentHcp = await api.healthcarePartyApi.createHealthcareParty(
      new HealthcareParty({ id: uuid(), publicKey: publicKeyParent, firstName: 'parent', lastName: 'parent' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
    )

    delegateHcp = await api.healthcarePartyApi.createHealthcareParty(
      new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test', parentId: parentHcp.id }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
    )

    hcpUser = await api.userApi.createUser(
      new User({
        id: `user-${uuid()}-hcp`,
        login: hcpLogin,
        status: 'ACTIVE',
        passwordHash: 'LetMeInForReal',
        healthcarePartyId: delegateHcp.id,
      })
    )

    console.log('All prerequisites are started')
  })

  after(async () => {})

  it(`Share patient from hcp to patient`, async () => {
    const u = hcpUser!
    const api = await getApiAndAddPrivateKeysForUser(u)

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
      `http://127.0.0.1:${AS_PORT}/rest/v1`,
      newPatientUser.login!,
      'LetMeInForReal',
      webcrypto as unknown as Crypto,
      fetch,
      true
    )
    const publicKeyPatient = await makeKeyPair(apiAsPatient.cryptoApi, newPatientUser.login!)

    const patientBaseApi = new IccPatientApi(
      `http://127.0.0.1:${AS_PORT}/rest/v1`,
      {},
      new BasicAuthenticationProvider(newPatientUser.login!, 'LetMeInForReal')
    )

    const pat = await patientBaseApi.getPatient(patient.id)

    expect(pat.note ?? undefined).to.be.undefined

    await patientBaseApi.modifyPatient({ ...pat, publicKey: publicKeyPatient })

    const apiForSharing = await getApiAndAddPrivateKeysForUser(u)
    await apiForSharing.patientApi.share(u, patient.id, u.healthcarePartyId!, [patient.id], { [patient.id]: ['all'] })

    const apiForReading = await getApiAndAddPrivateKeysForUser(newPatientUser)

    const entity = await apiForReading.patientApi.getPatientWithUser(await apiForReading.userApi.getCurrentUser(), patient.id)

    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null
    expect(entity.note).to.equal('secure')
  })
})
