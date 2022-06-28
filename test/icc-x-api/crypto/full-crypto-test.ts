import { spawn, execSync } from 'child_process'
import { Api, b2a, hex2ua, IccCryptoXApi, pkcs8ToJwk, retry, spkiToJwk, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { XHR } from '../../../icc-api/api/XHR'
import { Patient } from '../../../icc-api/model/Patient'
import { Contact } from '../../../icc-api/model/Contact'
import { HealthElement } from '../../../icc-api/model/HealthElement'
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

interface EntityFacade<T extends EncryptedEntity> {
  create: (api: ReturnType<typeof Api>, record: Omit<T, 'rev'>) => Promise<T>
  get: (api: ReturnType<typeof Api>, id: string) => Promise<T>
  share: (api: ReturnType<typeof Api>, parent: EncryptedParentEntity | null, record: T, dataOwnerId: string) => Promise<T>
}

type EntityCreator<T> = (api: ReturnType<typeof Api>, id: string, user: User, patient?: Patient) => Promise<T>

interface EntityFacades {
  Patient: EntityFacade<Patient>
  Contact: EntityFacade<Contact>
  HealthElement: EntityFacade<HealthElement>
}

interface EntityCreators {
  Patient: EntityCreator<Patient>
  Contact: EntityCreator<Contact>
  HealthElement: EntityCreator<HealthElement>
}

async function getDataOwnerId(api: ReturnType<typeof Api>) {
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
      return api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, dels[0], eks[0])
    },
  } as EntityFacade<Patient>,
  Contact: {
    create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, null, null)
    },
  } as EntityFacade<Contact>,
  HealthElement: {
    create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const ownerId = await getDataOwnerId(api)
      const [dels, eks] = await api.cryptoApi.extractDelegationsSFKsAndEncryptionSKs(r, ownerId)
      return api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, ownerId, doId, null, null)
    },
  } as EntityFacade<HealthElement>,
}

const DB_PORT = 15984
const AS_PORT = 16044

const privateKeys = {} as Record<string, Record<string, string>>
const users: User[] = []
let delegate: HealthcareParty | undefined = undefined

const entities: EntityCreators = {
  Patient: ({ patientApi }, id, user) => {
    return patientApi.newInstance(user, new Patient({ id, firstName: 'test', lastName: 'test', dateOfBirth: 20000101 }))
  },
  Contact: ({ contactApi }, id, user, patient) => {
    return contactApi.newInstance(
      user,
      patient!,
      new Contact({ id, services: [new Service({ label: 'svc', content: { fr: { stringValue: 'data' } } })] })
    )
  },
  HealthElement: ({ healthcareElementApi }, id, user, patient) => {
    return healthcareElementApi.newInstance(user, patient!, new HealthElement({ id, descr: 'HE' }))
  },
}
const userDefinitions: Record<string, (user: User, api: ReturnType<typeof Api>) => Promise<User>> = {
  'two available keys': async (user: User, { cryptoApi, maintenanceTaskApi }) => {
    const { privateKey, publicKey } = await cryptoApi.addNewKeyPairForOwnerId(maintenanceTaskApi, user, (user.healthcarePartyId ?? user.patientId)!)
    privateKeys[user.login!] = { ...(privateKeys[user.login!] ?? {}), [publicKey]: privateKey }
    return user
  },
  'a single available key in old format': async (user: User) => user,
  'a single lost key': async (user: User) => {
    privateKeys[user.login!] = {}
    return user
  },
  'one lost key and one available key': async (user: User, { cryptoApi, maintenanceTaskApi }) => {
    const { privateKey, publicKey } = await cryptoApi.addNewKeyPairForOwnerId(maintenanceTaskApi, user, (user.healthcarePartyId ?? user.patientId)!)
    privateKeys[user.login!] = { [publicKey]: privateKey }
    return user
  },
  'one lost key recoverable through transfer keys': async (user: User) => {
    return user
  },
  'one available key and one lost key recoverable through transfer keys': async (user: User) => {
    return user
  },
}

async function makeKeyPair(cryptoApi: IccCryptoXApi, login: string) {
  const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
  privateKeys[login] = { [publicKeyHex]: ua2hex((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer) }
  return publicKeyHex
}

describe('Full battery on tests on crypto and keys', async function () {
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
        'docker.taktik.be/icure-oss:2.4.2-kraken.8f6b845a8b',
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

    const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, 'admin', 'admin', webcrypto as unknown as Crypto)
    const { userApi, patientApi, healthcarePartyApi, cryptoApi } = api
    const user = await retry(() => {
      return userApi.getCurrentUser()
    }, 100)

    if (user) {
      const patientBaseApi = new IccPatientApi(`http://127.0.0.1:${AS_PORT}/rest/v1`, {
        Authorization: `Basic ${b2a(`${user.id}:admin`)}`,
      })

      const publicKeyDelegate = await makeKeyPair(cryptoApi, `hcp-delegate`)
      delegate = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
      )

      await Object.entries(userDefinitions).reduce(async (p, [login, creationProcess]) => {
        await p

        const publicKeyPatient = await makeKeyPair(cryptoApi, `patient-${login}`)
        const patient = await patientBaseApi.createPatient(
          new Patient({ id: uuid(), publicKey: publicKeyPatient, firstName: 'test', lastName: 'test' })
        )

        const publicKeyHcp = await makeKeyPair(cryptoApi, `hcp-${login}`)
        const hcp = await healthcarePartyApi.createHealthcareParty(
          new Patient({ id: uuid(), publicKey: publicKeyHcp, firstName: 'test', lastName: 'test' })
        )

        const newPatientUser = await userApi.createUser(
          new User({
            id: `user-${uuid()}-patient`,
            login: `patient-${login}`,
            status: 'ACTIVE',
            passwordHash: hashedAdmin,
            patientId: patient.id,
          })
        )
        const newHcpUser = await userApi.createUser(
          new User({
            id: `user-${uuid()}-hcp`,
            login: `hcp-${login}`,
            status: 'ACTIVE',
            passwordHash: hashedAdmin,
            healthcarePartyId: hcp.id,
          })
        )

        users.push(await creationProcess(newPatientUser, api))
        users.push(await creationProcess(newHcpUser, api))
      }, Promise.resolve())
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

  it('Wait for test to start', () => {
    console.log('Everything is ready')
  })
  ;['patient', 'hcp'].forEach((uType) => {
    Object.keys(userDefinitions).forEach((uId) => {
      Object.entries(facades).forEach((f) => {
        it(`Create ${f[0]} as a ${uType} with ${uId}`, async () => {
          const u = users.find((it) => it.login === `${uType}-${uId}`)!
          const facade: EntityFacade<any> = f[1]
          const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)

          const dow = await api.cryptoApi.getDataOwner((u.healthcarePartyId ?? u.patientId)!)

          await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
            await p
            await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
          }, Promise.resolve())

          const parent = f[0] !== 'Patient' ? await api.patientApi.getPatientWithUser(u, `${u.id}-Patient`) : undefined
          const record = await entities[f[0] as 'Patient' | 'Contact' | 'HealthElement'](api, `${u.id}-${f[0]}`, u, parent)
          const entity = await facade.create(api, record)

          expect(entity.id).to.be.not.null
          expect(entity.rev).to.be.not.null
        })

        it(`Read ${f[0]} as a ${uType} with ${uId}`, async () => {
          const u = users.find((it) => it.login === `${uType}-${uId}`)!
          const facade = f[1]
          const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)
          await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
            await p
            await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
          }, Promise.resolve())

          const entity = await facade.get(api, `${u.id}-${f[0]}`)
          expect(entity.id).to.equal(`${u.id}-${f[0]}`)
        })

        it(`Share ${f[0]} as a ${uType} with ${uId}`, async () => {
          const u = users.find((it) => it.login === `${uType}-${uId}`)!
          const facade = f[1]
          const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)
          await Object.entries(privateKeys[u.login!]).reduce(async (p, [pubKey, privKey]) => {
            await p
            await api.cryptoApi.cacheKeyPair({ publicKey: spkiToJwk(hex2ua(pubKey)), privateKey: pkcs8ToJwk(hex2ua(privKey)) })
          }, Promise.resolve())

          const parent = f[0] !== 'Patient' ? await api.patientApi.getPatientWithUser(u, `${u.id}-Patient`) : undefined
          const entity = await facade.share(api, parent, await facade.get(api, `${u.id}-${f[0]}`), delegate!.id)
          expect(Object.keys(entity.delegations)).to.contain(delegate!.id)
        })
      })
    })
  })
})
