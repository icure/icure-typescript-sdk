import { Api, Apis, ua2hex } from '../../../icc-x-api'
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
import { TestKeyStorage, TestStorage } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { DefaultStorageEntryKeysFactory } from '../../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'

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

    // Create a Record to share with delegateHcp: this will trigger the creation of a new aes exchange key as well
    const initialRecord = await api.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci-initial`, title: 'CI-INITIAL' }), [
      delegateHcp!.id!,
    ])
    const savedInitialRecord = await api.calendarItemApi.createCalendarItemWithHcParty(u, initialRecord)

    // Decrypting this AES Key to compare it with AES key decrypted with new key in the next steps
    await api.cryptoApi.forceReload(true)
    const decryptedAesWithPreviousKey = await api.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(patient.id!, delegateHcp.id!)
    expect(decryptedAesWithPreviousKey).to.have.length(1)
    const oldExchangeKeyRaw = ua2hex(await api.cryptoApi.primitives.AES.exportKey(decryptedAesWithPreviousKey[0], 'raw'))

    // And creates a new one
    const newKey = await api.cryptoApi.primitives.RSA.generateKeyPair()
    const publicKey = ua2hex(await api.cryptoApi.primitives.RSA.exportKey(newKey.publicKey, 'spki'))
    const apiAfterNewKey = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      new TestCryptoStrategies(newKey),
      webcrypto as unknown as Crypto,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    const user = await apiAfterNewKey.userApi.getCurrentUser()
    await apiAfterNewKey.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(user, newKey)
    // Api with new key should not be able to decrypt past exchange key with delegateHcp
    await apiAfterNewKey.cryptoApi.forceReload(true)
    const decryptedAesAfterShareBackRequest = await apiAfterNewKey.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(patient.id!, delegateHcp.id!)
    expect(decryptedAesAfterShareBackRequest).to.have.length(1)
    const newExchangeKeyRaw = ua2hex(await api.cryptoApi.primitives.AES.exportKey(decryptedAesAfterShareBackRequest[0], 'raw'))

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
    await delegateApi.cryptoApi.forceReload(false)
    const maintenanceTask = new KeyPairUpdateRequest(await _getHcpKeyUpdateMaintenanceTask(delegateApi))

    expect(maintenanceTask.concernedDataOwnerId).equals(patient.id)
    expect(maintenanceTask.newPublicKey).equals(publicKey)

    await delegateApi.icureMaintenanceTaskApi.applyKeyPairUpdate(maintenanceTask)
    const updatedDataOwner = await delegateApi.dataOwnerApi.getDataOwner(maintenanceTask.concernedDataOwnerId)

    expect(updatedDataOwner.type).to.be.equal('patient')
    expect(updatedDataOwner.dataOwner).to.not.be.undefined
    expect(updatedDataOwner.dataOwner).to.not.be.null
    expect(updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!][publicKey.slice(-32)]).to.be.not.undefined
    expect(updatedDataOwner.dataOwner.aesExchangeKeys![previousPubKey][delegateUser!.healthcarePartyId!][publicKey.slice(-32)]).to.be.not.null

    const apiAfterSharedBack = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      new TestCryptoStrategies(newKey),
      webcrypto as unknown as Crypto,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    await apiAfterSharedBack.cryptoApi.forceReload(true)
    const decryptedAesWithShareBack = await apiAfterSharedBack.cryptoApi.exchangeKeys.getDecryptionExchangeKeysFor(patient.id!, delegateHcp.id!)
    expect(decryptedAesWithShareBack).to.have.length(2)
    const shareBackKeysRaw = await Promise.all(
      decryptedAesWithShareBack.map((k) => api.cryptoApi.primitives.AES.exportKey(k, 'raw').then((x) => ua2hex(x)))
    )

    // Patient can decrypt the new hcPartyKey
    expect(shareBackKeysRaw).to.not.contain(null)
    expect(shareBackKeysRaw).to.not.contain(undefined)
    expect(shareBackKeysRaw).to.contain(oldExchangeKeyRaw)
    expect(shareBackKeysRaw).to.contain(newExchangeKeyRaw)

    // User can access his previous data again
    await apiAfterSharedBack.cryptoApi.forceReload(true)

    const initialRecordAfterSharedBack = await apiAfterSharedBack.calendarItemApi.getCalendarItemWithUser(u, initialRecord.id!)
    expect(initialRecordAfterSharedBack.id).to.be.equal(savedInitialRecord.id)
    expect(initialRecordAfterSharedBack.rev).to.be.equal(savedInitialRecord.rev)
    expect(initialRecordAfterSharedBack.title).to.be.equal(savedInitialRecord.title)
  })
})

// TODO test that EXACTLY ONE maintenance task is created for each delegator AND delegate in a exchange key with the data owner with the new key
