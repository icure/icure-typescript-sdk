import { Api, Apis, b2a, hex2ua, IccCryptoXApi, pkcs8ToJwk, retry, spkiToJwk, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { XHR } from '../../../icc-api/api/XHR'
import { Patient } from '../../../icc-api/model/Patient'
import { Contact } from '../../../icc-api/model/Contact'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { EncryptedEntity, EncryptedParentEntity, HealthcareParty, Service, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { tmpdir } from 'os'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { TextDecoder, TextEncoder } from 'util'
import { bootstrapOssKraken, setup, setupCouchDb } from '@icure/test-setup'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 * 1024 * 1024)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder

type TestedEntity = 'Patient' | 'Contact' | 'HealthElement' | 'CalendarItem'

interface EntityFacade<T extends EncryptedEntity> {
  create: (api: Apis, record: Omit<T, 'rev'>) => Promise<T>
  get: (api: Apis, id: string) => Promise<T>
  share: (api: Apis, parent: EncryptedParentEntity | null, record: T, dataOwnerId: string) => Promise<T>
  isDecrypted: (entityToCheck: T) => Promise<boolean>
}

type EntityCreator<T> = (api: Apis, id: string, user: User, patient?: Patient, delegateIds?: string[]) => Promise<T>

interface EntityFacades {
  Patient: EntityFacade<Patient>
  Contact: EntityFacade<Contact>
  HealthElement: EntityFacade<HealthElement>
  CalendarItem: EntityFacade<CalendarItem>
}

interface EntityCreators {
  Patient: EntityCreator<Patient>
  Contact: EntityCreator<Contact>
  HealthElement: EntityCreator<HealthElement>
  CalendarItem: EntityCreator<CalendarItem>
}

async function getDataOwnerId(api: Apis) {
  const user = await api.userApi.getCurrentUser()
  return (user.healthcarePartyId ?? user.patientId ?? user.deviceId)!
}

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
  const api = await Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'LetMeInForReal', webcrypto as unknown as Crypto, fetch, true)
  await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
    await p
    await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
  }, Promise.resolve())
  return api
}

describe('Full battery of tests on crypto and keys', async function () {
  this.timeout(600000)

  before(async function () {
    this.timeout(300000)

    await setup('test/scratchDir', 'docker-compose')
    await setupCouchDb('127.0.0.1', 15984)
    const userId = uuid()
    await bootstrapOssKraken(userId)

    const api = await Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, 'john', 'LetMeIn', webcrypto as unknown as Crypto)
    const { userApi, healthcarePartyApi, cryptoApi } = api
    const user = await retry(() => {
      return userApi.getCurrentUser()
    }, 100)

    if (user) {
      const hcpLogin = `hcp-${uuid()}-delegate`

      const publicKeyDelegate = await makeKeyPair(cryptoApi, hcpLogin)
      const publicKeyParent = await makeKeyPair(cryptoApi, `hcp-parent`)

      const parentHcp = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyParent, firstName: 'parent', lastName: 'parent' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
      )

      delegateHcp = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test', parentId: parentHcp.id }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
      )

      hcpUser = await userApi.createUser(
        new User({
          id: `user-${uuid()}-hcp`,
          login: hcpLogin,
          status: 'ACTIVE',
          passwordHash: 'LetMeInForReal', //pragma: allowlist secret
          healthcarePartyId: delegateHcp.id,
        })
      )
    }

    console.log('All prerequisites are started')
  })

  after(async () => {
    /*
    try {
      execSync('docker rm -f couchdb-test')
    } catch (e) {}
    try {
      execSync('docker rm -f icure-oss-test')
    } catch (e) {}
    try {
      execSync('docker network rm network-test')
    } catch (e) {}
    */
    console.log('Cleanup complete')
  })
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

    const patientBaseApi = new IccPatientApi(`http://127.0.0.1:${AS_PORT}/rest/v1`, {
      Authorization: `Basic ${b2a(`${newPatientUser.login}:LetMeInForReal`)}`,
    })

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
