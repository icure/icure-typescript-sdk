import { spawn, execSync } from 'child_process'
import { Api, b2a, IccCryptoXApi, retry, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { XHR } from '../../../icc-api/api/XHR'
import { Patient } from '../../../icc-api/model/Patient'
import { Contact } from '../../../icc-api/model/Contact'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { EncryptedEntity, EncryptedParentEntity, HealthcareParty, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'
import { webcrypto } from 'crypto'

import 'isomorphic-fetch'

interface EntityFacade<T extends EncryptedEntity> {
  create: (api: ReturnType<typeof Api>, record: Omit<T, 'rev'>) => Promise<T>
  get: (api: ReturnType<typeof Api>, id: string) => Promise<T>
  share: (api: ReturnType<typeof Api>, parent: EncryptedParentEntity | null, record: T, dataOwnerId: string) => Promise<T>
}

interface EntityFacades {
  Patient: EntityFacade<Patient>
  Contact: EntityFacade<Contact>
  HealthElement: EntityFacade<HealthElement>
}

async function getDataOwnerId(api: ReturnType<typeof Api>) {
  const user = await api.userApi.getCurrentUser()
  return (user.healthcarePartyId ?? user.patientId ?? user.deviceId)!
}

const facades: EntityFacades = {
  Patient: {
    create: async (api, r) => api.patientApi.createPatientWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.patientApi.getPatient(id),
    share: async (api, p, r, doId) => api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, await getDataOwnerId(api), doId, null, null),
  } as EntityFacade<Patient>,
  Contact: {
    create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, await getDataOwnerId(api), doId, null, null),
  } as EntityFacade<Contact>,
  HealthElement: {
    create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => api.cryptoApi.addDelegationsAndEncryptionKeys(p, r, await getDataOwnerId(api), doId, null, null),
  } as EntityFacade<HealthElement>,
}

const DB_PORT = 15984
const AS_PORT = 16044

const privateKeys = {} as Record<string, Record<string, string>>
const users: User[] = []
let delegate: HealthcareParty | undefined = undefined

const userDefinitions: Record<string, (user: User, api: ReturnType<typeof Api>) => Promise<User>> = {
  'a single available key in old format': async (user: User) => user,
  'a single lost key': async (user: User) => {
    delete privateKeys[user.login!]
    return user
  },
  'one lost key and one available key': async (user: User, { cryptoApi }) => {
    const { privateKey, publicKey } = await cryptoApi.addNewKeyPairForOwner((user.healthcarePartyId ?? user.patientId)!)
    privateKeys[user.login!] = { ...(privateKeys[user.login!] ?? {}), [publicKey.slice(-12)]: privateKey }
    return user
  },
  'one lost key recoverable through transfer keys': async (user: User) => {
    return user
  },
  'two available keys': async (user: User) => {
    return user
  },
  'one available key and one lost key recoverable through transfer keys': async (user: User) => {
    return user
  },
}

async function makeKeyPair(cryptoApi: IccCryptoXApi, login: string) {
  const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
  privateKeys[login] = { [publicKeyHex.slice(-12)]: ua2hex((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer) }
  return publicKeyHex
}

describe('Full battery on tests on crypto and keys', async function () {
  this.timeout(600000)

  before(async function () {
    this.timeout(120000)

    const couchdbUser = process.env['ICURE_COUCHDB_USERNAME'] ?? 'icure'
    const couchdbPassword = process.env['ICURE_COUCHDB_PASSWORD'] ?? 'icure'

    try {
      execSync('docker network create network-test')
    } catch (e) {}

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
      'docker.taktik.be/icure-oss:2.4.1-kraken.df7d7499e6',
    ])
    icureOss.stdout.on('data', (data) => console.log(`stdout: ${data}`))
    icureOss.stderr.on('data', (data) => console.error(`stderr: ${data}`))
    icureOss.on('close', (code) => console.log(`child process exited with code ${code}`))

    await retry(() => XHR.sendCommand('GET', `http://127.0.0.1:${AS_PORT}/rest/v1/icure/v`, null), 100)

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
      const publicKeyDelegate = await makeKeyPair(cryptoApi, `hcp-delegate`)
      delegate = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test' })
      )

      await Object.entries(userDefinitions).reduce(async (p, [login, creationProcess]) => {
        await p

        const publicKeyPatient = await makeKeyPair(cryptoApi, `patient-${login}`)
        const patient = await patientApi.createPatientWithUser(
          user,
          new Patient({ id: uuid(), publicKey: publicKeyPatient, firstName: 'test', lastName: 'test' })
        )

        const publicKeyHcp = await makeKeyPair(cryptoApi, `hcp-${login}`)
        const hcp = await healthcarePartyApi.createHealthcareParty(
          new Patient({ id: uuid(), publicKey: publicKeyHcp, firstName: 'test', lastName: 'test' })
        )

        const newPatientUser = await userApi.createUser(
          new User({
            id: uuid(),
            login,
            status: 'ACTIVE',
            java_type: 'org.taktik.icure.entities.User',
            passwordHash: hashedAdmin,
            patientId: patient.id,
          })
        )
        const newHcpUser = await userApi.createUser(
          new User({
            id: uuid(),
            login,
            status: 'ACTIVE',
            java_type: 'org.taktik.icure.entities.User',
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
    try {
      execSync('docker rm -f couchdb-test')
    } catch (e) {}
    try {
      execSync('docker rm -f icure-oss-test')
    } catch (e) {}
    try {
      execSync('docker network rm network-test')
    } catch (e) {}

    console.log('Cleanup complete')
  })

  it('Wait for test to start', () => {
    console.log('Everything is ready')
  })

  users.forEach((u) => {
    Object.entries(facades).forEach((f) => {
      it(`Create ${f[0]} for ${u.login}`, () => {
        const facade: EntityFacade<any> = f[1]
        const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)

        facade.create(api, { id: `${u.id}-${f[0]}` })
      })

      it(`Read ${f[0]} for ${u.login}`, () => {
        const facade = f[1]
        const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)

        facade.get(api, `${u.id}-${f[0]}`)
      })

      it(`Share ${f[0]} for ${u.login}`, () => {
        const facade = f[1]
        const api = Api(`http://127.0.0.1:${AS_PORT}/rest/v1`, u.login!, 'admin', webcrypto as unknown as Crypto)

        facade.share(api, null, `${u.id}-${f[0]}`, delegate!.id)
      })
    })
  })
})
