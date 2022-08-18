import { spawn, execSync } from 'child_process'
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

const facades: EntityFacades = {
  Patient: {
    create: async (api, r) => api.patientApi.createPatientWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.patientApi.getPatientWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.patientApi.modifyPatientWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.note != undefined
    },
  } as EntityFacade<Patient>,
  Contact: {
    create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.contactApi.modifyContactWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.services?.[0].content != undefined && Object.entries(entityToCheck.services?.[0].content).length > 0
    },
  } as EntityFacade<Contact>,
  HealthElement: {
    create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.healthcareElementApi.modifyHealthElementWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.descr != undefined
    },
  } as EntityFacade<HealthElement>,
  CalendarItem: {
    create: async (api, r) =>
      api.calendarItemApi.createCalendarItemWithHcParty(
        await api.userApi.getCurrentUser(),
        await api.calendarItemApi.newInstance(await api.userApi.getCurrentUser(), r)
      ),
    get: async (api, id) => api.calendarItemApi.getCalendarItemWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.calendarItemApi.modifyCalendarItemWithHcParty(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.title != undefined
    },
  } as EntityFacade<CalendarItem>,
}

const DB_PORT = 15984
const AS_PORT = 16044

const privateKeys = {} as Record<string, Record<string, string>>
const users: User[] = []

let newPatientUser: User | undefined = undefined
let newPatient: Patient | undefined = undefined
let delegateUser: User | undefined = undefined
let delegateHcp: HealthcareParty | undefined = undefined

const entities: EntityCreators = {
  Patient: ({ patientApi }, id, user, _, delegateIds) => {
    return patientApi.newInstance(user, new Patient({ id, firstName: 'test', lastName: 'test', note: 'data', dateOfBirth: 20000101 }), delegateIds)
  },
  Contact: ({ contactApi }, id, user, patient, delegateIds) => {
    return contactApi.newInstance(
      user,
      patient!,
      new Contact({ id, services: [new Service({ label: 'svc', content: { fr: { stringValue: 'data' } } })] }),
      false,
      delegateIds
    )
  },
  HealthElement: ({ healthcareElementApi }, id, user, patient, delegateIds) => {
    return healthcareElementApi.newInstance(user, patient!, new HealthElement({ id, descr: 'HE' }), false, delegateIds)
  },
  CalendarItem: ({ calendarItemApi }, id, user, patient, delegateIds) => {
    return calendarItemApi.newInstancePatient(user, patient!, new CalendarItem({ id, title: 'CI' }), delegateIds)
  },
}

async function makeKeyPair(cryptoApi: IccCryptoXApi, login: string) {
  const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
  privateKeys[login] = { [publicKeyHex]: ua2hex((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer) }
  return publicKeyHex
}

async function getApiAndAddPrivateKeysForUser(u: User) {
  const api = await Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto, fetch, true)
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

    const couchdbUser = process.env['ICURE_COUCHDB_USERNAME'] ?? 'icure'
    const couchdbPassword = process.env['ICURE_COUCHDB_PASSWORD'] ?? 'icure'

    try {
      execSync('docker network create network-test')
    } catch (e) {}

    let dbLaunched = false
    try {
      dbLaunched = !!(await XHR.sendCommand('GET', `http://127.0.0.1:${DB_PORT}`, null))
    } catch (e) {}

    if (!dbLaunched) {
      const couchdb = spawn('docker', [
        'run',
        '--network',
        'network-test',
        '-p',
        `${DB_PORT}:5984`,
        '-e',
        `COUCHDB_USER=${couchdbUser}`,
        '-e',
        `COUCHDB_PASSWORD=${couchdbPassword}`,
        '-d',
        '--name',
        'couchdb-test',
        'couchdb:3.2.2',
      ])
      couchdb.stdout.on('data', (data) => console.log(`stdout: ${data}`))
      couchdb.stderr.on('data', (data) => console.error(`stderr: ${data}`))
      couchdb.on('close', (code) => console.log(`child process exited with code ${code}`))

      await retry(() => XHR.sendCommand('GET', `http://127.0.0.1:${DB_PORT}`, null), 10)
    } else {
      try {
        //Cleanup
        const tbd = (
          await XHR.sendCommand('GET', `http://127.0.0.1:${DB_PORT}/icure-base/_all_docs`, [
            new XHR.Header('Content-type', 'application/json'),
            new XHR.Header('Authorization', `Basic ${b2a(`${couchdbUser}:${couchdbPassword}`)}`),
          ])
        ).body.rows
          .filter((r: any) => r.id.startsWith('user-'))
          .map((it: any) => ({ _id: it.id, _rev: it.value.rev, deleted: true }))
        await XHR.sendCommand(
          'POST',
          `http://127.0.0.1:${DB_PORT}/icure-base/_bulk_docs`,
          [new XHR.Header('Content-type', 'application/json'), new XHR.Header('Authorization', `Basic ${b2a(`${couchdbUser}:${couchdbPassword}`)}`)],
          { docs: tbd }
        )
      } catch (e) {
        //ignore
      }
    }

    let asLaunched = false
    try {
      asLaunched = !!(await XHR.sendCommand('GET', `http://127.0.0.1:${AS_PORT}/rest/v1/icure/v`, null))
    } catch (e) {}

    if (!asLaunched) {
      const icureOss = spawn('docker', [
        'run',
        '--network',
        'network-test',
        '-p',
        `5005:5005`,
        '-p',
        `${AS_PORT}:16043`,
        '-e',
        'JAVA_OPTS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005',
        '-e',
        `ICURE_COUCHDB_URL=http://couchdb-test:5984`,
        '-e',
        `ICURE_COUCHDB_USERNAME=${couchdbUser}`,
        '-e',
        `ICURE_COUCHDB_PASSWORD=${couchdbPassword}`,
        '-e',
        'ICURE_AUTHENTICATION_LOCAL=true',
        '-d',
        '--name',
        'icure-oss-test',
        'docker.taktik.be/icure-oss:2.4.23-kraken.c1b1db7acc',
      ])
      icureOss.stdout.on('data', (data) => console.log(`stdout: ${data}`))
      icureOss.stderr.on('data', (data) => console.error(`stderr: ${data}`))
      icureOss.on('close', (code) => console.log(`child process exited with code ${code}`))

      await retry(() => XHR.sendCommand('GET', `http://127.0.0.1:${AS_PORT}/rest/v1/icure/v`, null), 100, 5000)
    }
    const hashedAdmin = '{R0DLKxxRDxdtpfY542gOUZbvWkfv1KWO9QOi9yvr/2c=}39a484cbf9057072623177422172e8a173bd826d68a2b12fa8e36ff94a44a0d7'

    await retry(
      () =>
        XHR.sendCommand(
          'POST',
          `http://127.0.0.1:${DB_PORT}/icure-base`,
          [new XHR.Header('Content-type', 'application/json'), new XHR.Header('Authorization', `Basic ${b2a(`${couchdbUser}:${couchdbPassword}`)}`)],
          { _id: uuid(), login: 'admin', status: 'ACTIVE', java_type: 'org.taktik.icure.entities.User', passwordHash: hashedAdmin }
        ),
      100
    )

    const api = await Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, 'admin', 'admin', webcrypto as unknown as Crypto)
    const { userApi, patientApi, healthcarePartyApi, cryptoApi } = api
    const user = await retry(() => {
      return userApi.getCurrentUser()
    }, 100)

    if (user) {
      const patientBaseApi = new IccPatientApi(`http://127.0.0.1:${AS_PORT}/rest/v1`, {
        Authorization: `Basic ${b2a(`${user.id}:admin`)}`,
      })

      const publicKeyDelegate = await makeKeyPair(cryptoApi, `hcp-delegate`)
      delegateHcp = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
      )
      delegateUser = await userApi.createUser(
        new User({
          id: `user-${uuid()}-hcp`,
          login: `hcp-delegate`,
          status: 'ACTIVE',
          passwordHash: hashedAdmin,
          healthcarePartyId: delegateHcp.id,
        })
      )

      const publicKeyPatient = await makeKeyPair(cryptoApi, `patient`)
      newPatient = await patientBaseApi.createPatient(new Patient({ id: uuid(), publicKey: publicKeyPatient, firstName: 'test', lastName: 'test' }))

      newPatientUser = await userApi.createUser(
        new User({
          id: `user-${uuid()}-patient`,
          login: `patient`,
          status: 'ACTIVE',
          passwordHash: hashedAdmin,
          patientId: newPatient.id,
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
  it(`Create calendar item as a patient}`, async () => {
    const u = newPatientUser!
    const api = await getApiAndAddPrivateKeysForUser(u)

    const patient = await api.patientApi.getPatientWithUser(u, u.patientId!)

    const patientWithDelegation = await api.patientApi.modifyPatientWithUser(
      u,
      await api.patientApi.initDelegationsAndEncryptionKeys(patient, u, undefined, [delegateUser!.healthcarePartyId!])
    )

    privateKeys['patient'] = {}

    const apiAfterLossOfKey = await getApiAndAddPrivateKeysForUser(u)
    const user = await apiAfterLossOfKey.userApi.getCurrentUser()
    const { privateKey, publicKey } = await apiAfterLossOfKey.cryptoApi.addNewKeyPairForOwnerId(
      apiAfterLossOfKey.maintenanceTaskApi,
      user,
      (user.healthcarePartyId ?? user.patientId)!,
      false
    )
    privateKeys[user.login!] = { [publicKey]: privateKey }

    const apiAfterNewKey = await getApiAndAddPrivateKeysForUser(user)

    const record = await apiAfterNewKey.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci`, title: 'CI' }), [
      delegateUser!.healthcarePartyId!,
    ])
    const entity = await apiAfterNewKey.calendarItemApi.createCalendarItemWithHcParty(u, record)

    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null
  })
})
