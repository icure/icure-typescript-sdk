import { Api, Apis, hex2ua, pkcs8ToJwk, spkiToJwk } from '../../../icc-x-api'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { FilterChainMaintenanceTask, MaintenanceTask, PaginatedListMaintenanceTask } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { expect } from 'chai'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import {
  getApiAndAddPrivateKeysForUser,
  getEnvironmentInitializer,
  getEnvVariables,
  hcp1Username,
  patUsername,
  setLocalStorage,
  TestVars,
} from '../../utils/test_utils'

async function _getHcpKeyUpdateMaintenanceTask(delegateApi: Apis): Promise<MaintenanceTask> {
  const delegateUser = await delegateApi.userApi.getCurrentUser()
  const notifications: PaginatedListMaintenanceTask = await delegateApi.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
    delegateUser!,
    undefined,
    undefined,
    new FilterChainMaintenanceTask({
      filter: new MaintenanceTaskAfterDateFilter({
        date: new Date().getTime() - 100000,
      }),
    })
  )

  return notifications.rows!.sort((a, b) => a.created! - b.created!)[notifications.rows!.length - 1]
}

setLocalStorage(fetch)

let env: TestVars | undefined

describe('Full battery of tests on crypto and keys', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it(`Create calendar item as a patient`, async () => {
    const previousPubKey = env!.dataOwnerDetails[patUsername].publicKey
    const api = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, env!.dataOwnerDetails[patUsername])
    const u = await api.userApi.getCurrentUser()

    const delegateApi = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username])
    const delegateUser = await delegateApi.userApi.getCurrentUser()
    const delegateHcp = await delegateApi.healthcarePartyApi.getHealthcareParty(delegateUser.healthcarePartyId!)

    const patient = await api.patientApi.getPatientWithUser(u, u.patientId!)
    const patientWithDelegation = await api.patientApi.modifyPatientWithUser(
      u,
      await api.patientApi.initDelegationsAndEncryptionKeys(patient, u, undefined, [delegateUser!.healthcarePartyId!])
    )

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
    ])
    const savedInitialRecord = await api.calendarItemApi.createCalendarItemWithHcParty(u, initialRecord)

    // And creates a new one
    const apiAfterNewKey = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      webcrypto as unknown as Crypto,
      fetch
    )
    const user = await apiAfterNewKey.userApi.getCurrentUser()
    const { privateKey, publicKey } = await apiAfterNewKey.cryptoApi.addNewKeyPairForOwnerId(
      apiAfterNewKey.maintenanceTaskApi,
      user,
      (user.healthcarePartyId ?? user.patientId)!,
      false
    )

    const jwk = {
      publicKey: spkiToJwk(hex2ua(publicKey)),
      privateKey: pkcs8ToJwk(hex2ua(privateKey)),
    }
    await apiAfterNewKey.cryptoApi.cacheKeyPair(jwk)
    await apiAfterNewKey.cryptoApi.keyStorage.storeKeyPair(`${user.patientId!}.${publicKey.slice(-32)}`, jwk)

    // User can get not encrypted information from iCure (HCP, ...)
    const hcp = await apiAfterNewKey.healthcarePartyApi.getHealthcareParty(delegateUser!.healthcarePartyId!)

    // User can create new data, using its new keyPair
    const newRecord = await apiAfterNewKey.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci`, title: 'CI' }), [hcp!.id!])
    const entity = await apiAfterNewKey.calendarItemApi.createCalendarItemWithHcParty(u, newRecord)
    expect(entity.id).to.be.not.null
    expect(entity.rev).to.be.not.null

    // But user can not decrypt data he previously created
    const initialRecordAfterNewKey = await apiAfterNewKey.calendarItemApi.getCalendarItemWithUser(u, initialRecord.id!)
    expect(initialRecordAfterNewKey.id).to.be.equal(savedInitialRecord.id)
    expect(initialRecordAfterNewKey.rev).to.be.equal(savedInitialRecord.rev)
    expect(initialRecordAfterNewKey.title).to.be.undefined

    // Delegate user will therefore give user access back to data he previously created

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

    const apiAfterSharedBack = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      webcrypto as unknown as Crypto,
      fetch
    )
    const newJwk = {
      publicKey: spkiToJwk(hex2ua(publicKey)),
      privateKey: pkcs8ToJwk(hex2ua(privateKey)),
    }
    await apiAfterSharedBack.cryptoApi.cacheKeyPair(newJwk)
    await apiAfterSharedBack.cryptoApi.keyStorage.storeKeyPair(`${user.patientId!}.${publicKey.slice(-32)}`, newJwk)

    const decryptedAesWithNewKey = await apiAfterSharedBack.cryptoApi.decryptHcPartyKey(
      user.patientId!,
      user.patientId!,
      delegateUser!.healthcarePartyId!,
      publicKey,
      updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!],
      [publicKey]
    )

    // Patient can decrypt the new hcPartyKey
    expect(decryptedAesWithNewKey.rawKey).to.not.be.undefined
    expect(decryptedAesWithNewKey.rawKey).to.not.be.null

    expect(decryptedAesWithNewKey.rawKey).to.be.equal(decryptedAesWithPreviousKey.rawKey)

    // User can access his previous data again
    apiAfterSharedBack.cryptoApi.emptyHcpCache(patient.id)

    const initialRecordAfterSharedBack = await apiAfterSharedBack.calendarItemApi.getCalendarItemWithUser(u, initialRecord.id!)
    expect(initialRecordAfterSharedBack.id).to.be.equal(savedInitialRecord.id)
    expect(initialRecordAfterSharedBack.rev).to.be.equal(savedInitialRecord.rev)
    expect(initialRecordAfterSharedBack.title).to.be.equal(savedInitialRecord.title)
  })
})
