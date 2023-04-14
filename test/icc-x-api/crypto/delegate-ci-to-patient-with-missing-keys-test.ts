import { Api, Apis, ua2hex } from '../../../icc-x-api'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { FilterChainMaintenanceTask, MaintenanceTask, PaginatedListMaintenanceTask } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { expect } from 'chai'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import {
  createNewHcpApi,
  getApiAndAddPrivateKeysForUser,
  getEnvironmentInitializer,
  getEnvVariables,
  patUsername,
  setLocalStorage,
  TestVars,
} from '../../utils/test_utils'
import { TestKeyStorage, TestStorage } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import { SecureDelegation } from '../../../dist/icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevel

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

  // TODO should give access back to old and new keys
  it(`Create calendar item as a patient and get access back`, async () => {
    async function decryptDataForPair(
      api: Apis,
      dataOwner1: string,
      dataOwner2: string
    ): Promise<{
      failedDecryptionsCount: number
      successfulDecryptions: { rawKey: string; accessControlSecret: string }[]
    }> {
      const allExchangeData = [
        ...(await api.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(dataOwner1, dataOwner2)),
        ...(await api.cryptoApi.exchangeData.base.getExchangeDataByDelegatorDelegatePair(dataOwner2, dataOwner1)),
      ]
      let failedDecryptionsCount = 0
      const successfulDecryptions: { rawKey: string; accessControlSecret: string }[] = []
      for (const exchangeData of allExchangeData) {
        const decryptedKey = await api.cryptoApi.exchangeData.base.tryDecryptExchangeKeys(
          [exchangeData],
          api.cryptoApi.userKeysManager.getDecryptionKeys()
        )
        const decryptedAccessControlSecret = await api.cryptoApi.exchangeData.base.tryDecryptAccessControlSecret(
          [exchangeData],
          api.cryptoApi.userKeysManager.getDecryptionKeys()
        )
        if (decryptedKey.failedDecryptions.length > 0 || decryptedAccessControlSecret.failedDecryptions.length > 0) {
          failedDecryptionsCount++
        } else {
          successfulDecryptions.push({
            rawKey: ua2hex(await api.cryptoApi.primitives.AES.exportKey(decryptedKey.successfulDecryptions[0], 'raw')),
            accessControlSecret: decryptedAccessControlSecret.successfulDecryptions[0],
          })
        }
      }
      return { failedDecryptionsCount, successfulDecryptions }
    }

    function checkDecryptedDataHas(
      decryptedData: { rawKey: string; accessControlSecret: string }[],
      expected: { rawKey: string; accessControlSecret: string }
    ) {
      expect(decryptedData.filter((d) => d.rawKey === expected.rawKey && d.accessControlSecret === expected.accessControlSecret)).to.have.length(1)
    }

    const previousPubKey = env!.dataOwnerDetails[patUsername].publicKey
    const api = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, env!.dataOwnerDetails[patUsername])
    const u = await api.userApi.getCurrentUser()

    const delegateInfo = await createNewHcpApi(env!)
    const delegateApi = delegateInfo.api
    const delegateUser = delegateInfo.user
    const delegateHcp = await delegateApi.healthcarePartyApi.getHealthcareParty(delegateUser.healthcarePartyId!)

    const patient = await api.patientApi.getPatientWithUser(u, u.patientId!)

    // Create a Record to share with delegateHcp: this will trigger the creation of a new aes exchange key as well
    const initialRecordToDelegate = await api.calendarItemApi.createCalendarItemWithHcParty(
      u,
      await api.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci-initial-to`, title: 'CI-INITIAL-TO' }), {
        additionalDelegates: {
          [delegateHcp!.id!]: AccessLevel.WRITE,
        },
      })
    )
    const initialRecordFromDelegate = await delegateApi.calendarItemApi.createCalendarItemWithHcParty(
      u,
      await delegateApi.calendarItemApi.newInstance(delegateUser, new CalendarItem({ id: `${u.id}-ci-initial-from`, title: 'CI-INITIAL-FROM' }), {
        additionalDelegates: {
          [u.patientId!]: AccessLevel.WRITE,
        },
      })
    )

    // Decrypting this AES Key to compare it with AES key decrypted with new key in the next steps
    await api.cryptoApi.forceReload()
    const originalDecryptedData = await decryptDataForPair(api, u.patientId!, delegateUser.healthcarePartyId!)
    expect(originalDecryptedData.failedDecryptionsCount).to.equal(0)
    expect(originalDecryptedData.successfulDecryptions.length).to.equal(2)

    // And creates a new one
    const newKey = await api.cryptoApi.primitives.RSA.generateKeyPair()
    const publicKey = ua2hex(await api.cryptoApi.primitives.RSA.exportKey(newKey.publicKey, 'spki'))
    const apiAfterNewKey = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      webcrypto as unknown as Crypto,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      {
        cryptoStrategies: new TestCryptoStrategies(newKey),
      }
    )
    const user = await apiAfterNewKey.userApi.getCurrentUser()
    await apiAfterNewKey.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(user, newKey)

    // User can get not encrypted information from iCure (HCP, ...)
    const hcp = await apiAfterNewKey.healthcarePartyApi.getHealthcareParty(delegateUser!.healthcarePartyId!)

    // User can create new data, using its new keyPair
    const newRecordToDelegate = await apiAfterNewKey.calendarItemApi.createCalendarItemWithHcParty(
      u,
      await apiAfterNewKey.calendarItemApi.newInstance(u, new CalendarItem({ id: `${u.id}-ci-to`, title: 'CI-TO' }), {
        additionalDelegates: {
          [hcp!.id!]: AccessLevel.WRITE,
        },
      })
    )
    expect(newRecordToDelegate.id).to.be.not.null
    expect(newRecordToDelegate.rev).to.be.not.null

    // But user can not decrypt data he previously created
    const decryptedWithNewKey = await decryptDataForPair(apiAfterNewKey, u.patientId!, delegateUser.healthcarePartyId!)
    expect(decryptedWithNewKey.failedDecryptionsCount).to.equal(2)
    expect(decryptedWithNewKey.successfulDecryptions.length).to.equal(1)

    // Delegate user will therefore give user access back to data he previously created

    // Hcp gets his maintenance tasks
    await delegateApi.cryptoApi.forceReload()
    const maintenanceTask = new KeyPairUpdateRequest(await _getHcpKeyUpdateMaintenanceTask(delegateApi))

    expect(maintenanceTask.concernedDataOwnerId).equals(patient.id)
    expect(maintenanceTask.newPublicKey).equals(publicKey)

    await delegateApi.icureMaintenanceTaskApi.applyKeyPairUpdate(maintenanceTask)
    const updatedDataOwner = await delegateApi.dataOwnerApi.getDataOwner(maintenanceTask.concernedDataOwnerId)

    expect(updatedDataOwner.type).to.be.equal('patient')
    expect(updatedDataOwner.dataOwner).to.not.be.undefined
    expect(updatedDataOwner.dataOwner).to.not.be.null

    const apiAfterSharedBack = await Api(
      env!.iCureUrl,
      env!.dataOwnerDetails[patUsername].user,
      env!.dataOwnerDetails[patUsername].password,
      webcrypto as unknown as Crypto,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      {
        cryptoStrategies: new TestCryptoStrategies(newKey),
      }
    )
    // User can access his previous data again
    await apiAfterSharedBack.cryptoApi.forceReload()
    const decryptedAfterShareBack = await decryptDataForPair(apiAfterSharedBack, u.patientId!, delegateUser.healthcarePartyId!)
    expect(decryptedAfterShareBack.failedDecryptionsCount).to.equal(0)
    expect(decryptedAfterShareBack.successfulDecryptions.length).to.equal(3)
    checkDecryptedDataHas(decryptedAfterShareBack.successfulDecryptions, originalDecryptedData.successfulDecryptions[0])
    checkDecryptedDataHas(decryptedAfterShareBack.successfulDecryptions, originalDecryptedData.successfulDecryptions[1])
    checkDecryptedDataHas(decryptedAfterShareBack.successfulDecryptions, decryptedWithNewKey.successfulDecryptions[0])

    const initialRecordFromDelegateAfterSharedBack = await apiAfterSharedBack.calendarItemApi.getCalendarItemWithUser(
      u,
      initialRecordFromDelegate.id!
    )
    expect(initialRecordFromDelegateAfterSharedBack.id).to.be.equal(initialRecordFromDelegate.id)
    expect(initialRecordFromDelegateAfterSharedBack.rev).to.be.equal(initialRecordFromDelegate.rev)
    expect(initialRecordFromDelegateAfterSharedBack.title).to.be.equal(initialRecordFromDelegate.title)
    const initialRecordToDelegateAfterSharedBack = await apiAfterSharedBack.calendarItemApi.getCalendarItemWithUser(u, initialRecordToDelegate.id!)
    expect(initialRecordToDelegateAfterSharedBack.id).to.be.equal(initialRecordToDelegate.id)
    expect(initialRecordToDelegateAfterSharedBack.rev).to.be.equal(initialRecordToDelegate.rev)
    expect(initialRecordToDelegateAfterSharedBack.title).to.be.equal(initialRecordToDelegate.title)
  })
})

// TODO test that EXACTLY ONE maintenance task is created for each delegator AND delegate in a exchange key with the data owner with the new key
