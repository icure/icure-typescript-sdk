import { execSync } from 'child_process'
import { Api, Apis, b2a, hex2ua, IccCryptoXApi, pkcs8ToJwk, retry, spkiToJwk, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { XHR } from '../../../icc-api/api/XHR'
import { Patient } from '../../../icc-api/model/Patient'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { FilterChainMaintenanceTask, HealthcareParty, MaintenanceTask, PaginatedListMaintenanceTask, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { tmpdir } from 'os'

import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'

import { TextDecoder, TextEncoder } from 'util'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 * 1024 * 1024)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder

const DB_PORT = 15984
const AS_PORT = 16044

const privateKeys = {} as Record<string, Record<string, string>>

let newPatientUser: User | undefined = undefined
let newPatient: Patient | undefined = undefined
let delegateUser: User | undefined = undefined
let delegateHcp: HealthcareParty | undefined = undefined

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

async function _getHcpKeyUpdateMaintenanceTask(delegateApi: Apis): Promise<MaintenanceTask> {
  const notifs: PaginatedListMaintenanceTask = await delegateApi.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
    delegateUser!,
    undefined,
    undefined,
    new FilterChainMaintenanceTask({
      filter: new MaintenanceTaskAfterDateFilter({
        date: new Date().getTime() - 100000,
      }),
    })
  )

  return notifs.rows!.sort((a, b) => a.created! - b.created!)[notifs.rows!.length - 1]
}

describe('Full battery of tests on crypto and keys', async function () {
  this.timeout(600000)

  before(async function () {
    this.timeout(300000)

    const couchdbUser = process.env['ICURE_COUCHDB_USERNAME'] ?? 'icure'
    const couchdbPassword = process.env['ICURE_COUCHDB_PASSWORD'] ?? 'icure'

    let dbLaunched = false
    try {
      dbLaunched = !!(await XHR.sendCommand('GET', `http://127.0.0.1:${DB_PORT}`, null))
    } catch (e) {}

    if (!dbLaunched) {
      try {
        execSync('docker compose up -d')
      } catch (e) {}
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

    await retry(() => XHR.sendCommand('GET', `http://127.0.0.1:${AS_PORT}/rest/v1/icure/v`, null), 100, 5000)
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
    const { userApi, healthcarePartyApi, cryptoApi } = api
    const user = await retry(() => {
      return userApi.getCurrentUser()
    }, 100)

    if (user) {
      const patientBaseApi = new IccPatientApi(`http://127.0.0.1:${AS_PORT}/rest/v1`, {
        Authorization: `Basic ${b2a(`${user.id}:admin`)}`,
      })

      const publicKeyDelegate = await makeKeyPair(cryptoApi, `hcp-delegate`)
      const publicKeyParent = await makeKeyPair(cryptoApi, `hcp-parent`)

      const parentHcp = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyParent, firstName: 'parent', lastName: 'parent' }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
      )

      delegateHcp = await healthcarePartyApi.createHealthcareParty(
        new HealthcareParty({ id: uuid(), publicKey: publicKeyDelegate, firstName: 'test', lastName: 'test', parentId: parentHcp.id }) //FIXME Shouldn't we call addNewKeyPair directly, instead of initialising like before ?
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
    const previousPubKey = Object.keys(privateKeys[u.login!])[0]
    const api = await getApiAndAddPrivateKeysForUser(u)

    const patient = await api.patientApi.getPatientWithUser(u, u.patientId!)
    const patientWithDelegation = await api.patientApi.modifyPatientWithUser(
      u,
      await api.patientApi.initDelegationsAndEncryptionKeys(patient, u, undefined, [delegateUser!.healthcarePartyId!])
    )

    console.log(`Patient = ${patient.id}`)
    console.log(`Delegate HCP = ${delegateHcp!.id}`)
    console.log(`Delegate HCP Parent = ${delegateHcp!.parentId}`)

    // Decrypting AES Key to compare it with AES key decrypted with new key in the next steps
    const decryptedAesWithPreviousKey = await api.cryptoApi.decryptHcPartyKey(
      patientWithDelegation!.id!,
      patientWithDelegation!.id!,
      delegateUser!.healthcarePartyId!,
      previousPubKey,
      patientWithDelegation!.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!],
      [previousPubKey]
    )

    // Create a Record with original key
    const initialRecord = await api.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci-initial`, title: 'CI-INITIAL' }), [
      delegateHcp!.id!,
      delegateHcp!.parentId!,
    ])
    const savedInitialRecord = await api.calendarItemApi.createCalendarItemWithHcParty(u, initialRecord)

    // User lost his key
    privateKeys[u.login!] = {}

    // And creates a new one
    const apiAfterLossOfKey = await getApiAndAddPrivateKeysForUser(u)
    const user = await apiAfterLossOfKey.userApi.getCurrentUser()
    const { privateKey, publicKey } = await apiAfterLossOfKey.cryptoApi.addNewKeyPairForOwnerId(
      apiAfterLossOfKey.maintenanceTaskApi,
      user,
      (user.healthcarePartyId ?? user.patientId)!,
      false
    )

    console.info(`Created new keypair ${publicKey}`)

    privateKeys[user.login!] = { [publicKey]: privateKey }

    const apiAfterNewKey = await getApiAndAddPrivateKeysForUser(user)

    // User can get not encrypted information from iCure (HCP, ...)
    const hcp = await apiAfterNewKey.healthcarePartyApi.getHealthcareParty(delegateUser!.healthcarePartyId!)

    // User can create new data, using its new keyPair
    const newRecord = await apiAfterNewKey.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci`, title: 'CI' }), [
      hcp!.id!,
      hcp!.parentId!,
    ])
    const entity = await apiAfterNewKey.calendarItemApi.createCalendarItemWithHcParty(u, newRecord)
    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null

    // But user can not decrypt data he previously created
    const initialRecordAfterNewKey = await apiAfterNewKey.calendarItemApi.getCalendarItemWithUser(u, initialRecord.id!)
    expect(initialRecordAfterNewKey.id).to.be.equal(savedInitialRecord.id)
    expect(initialRecordAfterNewKey.rev).to.be.equal(savedInitialRecord.rev)
    expect(initialRecordAfterNewKey.title).to.be.undefined

    // Delegate user will therefore give user access back to data he previously created
    const delegateApi = await getApiAndAddPrivateKeysForUser(delegateUser!)

    // Hcp gets his maintenance tasks
    const maintenanceTask = await _getHcpKeyUpdateMaintenanceTask(delegateApi)
    const patientId = maintenanceTask.properties!.find((prop) => prop.id === 'dataOwnerConcernedId')
    const patientPubKey = maintenanceTask.properties!.find((prop) => prop.id === 'dataOwnerConcernedPubKey')

    expect(patientId!.typedValue!.stringValue!).equals(patient.id)
    expect(patientPubKey!.typedValue!.stringValue!).equals(publicKey)

    const updatedDataOwner = await delegateApi.cryptoApi.giveAccessBackTo(
      delegateUser!,
      patientId!.typedValue!.stringValue!,
      patientPubKey!.typedValue!.stringValue!
    )

    expect(updatedDataOwner.type).to.be.equal('patient')
    expect(updatedDataOwner.dataOwner).to.not.be.undefined
    expect(updatedDataOwner.dataOwner).to.not.be.null
    expect(updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!][publicKey.slice(-32)]).to.be.not.undefined
    expect(updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!][publicKey.slice(-32)]).to.be.not.null

    const apiAfterSharedBack = await getApiAndAddPrivateKeysForUser(user)

    // const decryptedAesWithNewKey = await apiAfterSharedBack.cryptoApi.decryptHcPartyKey(
    //   user.patientId!,
    //   user.patientId!,
    //   delegateUser!.healthcarePartyId!,
    //   publicKey,
    //   updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!],
    //   [publicKey]
    // )
    //
    // // Patient can decrypt the new hcPartyKey
    // expect(decryptedAesWithNewKey.rawKey).to.not.be.undefined
    // expect(decryptedAesWithNewKey.rawKey).to.not.be.null
    //
    // expect(decryptedAesWithNewKey.rawKey).to.be.equal(decryptedAesWithPreviousKey.rawKey)
    //
    // // User can access his previous data again
    // apiAfterSharedBack.cryptoApi.emptyHcpCache(patient.id)

    const initialRecordAfterSharedBack = await apiAfterSharedBack.calendarItemApi.getCalendarItemWithUser(u, initialRecord.id!)
    expect(initialRecordAfterSharedBack.id).to.be.equal(savedInitialRecord.id)
    expect(initialRecordAfterSharedBack.rev).to.be.equal(savedInitialRecord.rev)
    expect(initialRecordAfterSharedBack.title).to.be.equal(savedInitialRecord.title)
  })
})
