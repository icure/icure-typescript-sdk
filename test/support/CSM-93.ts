import { getEnvironmentInitializer, hcp1Username, patUsername, setLocalStorage, TestUtils } from '../utils/test_utils'
import { IcureApi, ua2hex } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { FilterChainMaintenanceTask } from '../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { Service } from '../../icc-api/model/Service'
import { Contact } from '../../icc-api/model/Contact'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import initApi = TestUtils.initApi
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { KeyPairUpdateRequest } from '../../icc-x-api/maintenance/KeyPairUpdateRequest'
setLocalStorage(fetch)
import * as chaiAsPromised from 'chai-as-promised'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
chaiUse(chaiAsPromised)

let env: TestVars

describe('CSM-93', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('A patient should be able retrieve existing data after give access back', async function () {
    const hcpApis = await initApi(env, hcp1Username)
    const hcpUser = await hcpApis.userApi.getCurrentUser()
    const patApis = await initApi(env, patUsername)
    const patUser = await patApis.userApi.getCurrentUser()
    const patientNote = 'Some secret note'
    const p2 = await hcpApis.patientApi.createPatientWithUser(
      hcpUser,
      await hcpApis.patientApi.newInstance(
        hcpUser,
        {
          firstName: 'John',
          lastName: 'Doe',
          note: patientNote,
        },
        { additionalDelegates: { [patUser.patientId!]: 'WRITE' } }
      )
    )
    await patApis.cryptoApi.forceReload()
    const heNote = 'Another secret note'
    const he = await patApis.healthcareElementApi.createHealthElementWithUser(
      patUser,
      await patApis.healthcareElementApi.newInstance(
        patUser,
        p2,
        { note: heNote },
        { additionalDelegates: { [hcpUser.healthcarePartyId!]: 'WRITE' } }
      )
    )
    const ctcData = 'Some data'
    const ctcDescr = 'Some description'
    const ctc = await hcpApis.contactApi.createContactWithUser(
      hcpUser,
      await hcpApis.contactApi.newInstance(
        hcpUser,
        p2,
        {
          services: [new Service({ label: 'svc', content: { fr: { stringValue: ctcData } } })],
          descr: ctcDescr,
        },
        { additionalDelegates: { [patUser.patientId!]: 'WRITE' } }
      )
    )
    function checkContactDecrypted(ctc: Contact) {
      expect(ctc.services?.[0]?.content?.fr?.stringValue).to.equal(ctcData)
      expect(ctc.descr).to.equal(ctcDescr)
    }
    function checkContactEncrypted(ctc: Contact) {
      expect(ctc.services?.[0]).to.not.be.undefined
      expect(Object.keys(ctc.services![0].content ?? {})).to.be.empty
      expect(ctc.descr).to.be.undefined
    }
    expect((await hcpApis.patientApi.getPatientWithUser(hcpUser, p2.id!)).note).to.equal(patientNote)
    expect((await patApis.patientApi.getPatientWithUser(patUser, p2.id!)).note).to.equal(patientNote)
    expect((await hcpApis.healthcareElementApi.getHealthElementWithUser(hcpUser, he.id!)).note).to.equal(heNote)
    expect((await patApis.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).note).to.equal(heNote)
    checkContactDecrypted(await hcpApis.contactApi.getContactWithUser(hcpUser, ctc!.id!))
    checkContactDecrypted(await patApis.contactApi.getContactWithUser(patUser, ctc!.id!))
    const startTimestamp = new Date().getTime()
    const newPair = await patApis.cryptoApi.primitives.RSA.generateKeyPair('sha-256')
    const patApisLost = await IcureApi.initialise(
      env.iCureUrl,
      { username: env.dataOwnerDetails[patUsername].user, password: env.dataOwnerDetails[patUsername].password },
      new TestCryptoStrategies(newPair),
      webcrypto as any,
      fetch,
      {
        createMaintenanceTasksOnNewKey: true,
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    await expect(patApisLost.patientApi.getPatientWithUser(patUser, p2.id!)).to.be.rejected
    await expect(patApisLost.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).to.be.rejected
    await expect(patApisLost.contactApi.getContactWithUser(patUser, ctc!.id!)).to.be.rejected
    // The patient had to create a new aes exchange key to share the maintenance task with the hcp:
    // If you don't clear the cache of the hcp he will not be able to decrypt the maintenance task
    await hcpApis.cryptoApi.forceReload()
    const foundTasks =
      (
        await hcpApis.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
          hcpUser,
          undefined,
          undefined,
          new FilterChainMaintenanceTask({
            filter: new MaintenanceTaskAfterDateFilter({
              healthcarePartyId: hcpUser.healthcarePartyId!,
              date: startTimestamp - 1,
            }),
          })
        )
      ).rows ?? []
    expect(foundTasks.length).to.equal(1)
    const task = KeyPairUpdateRequest.fromMaintenanceTask(foundTasks[0] as MaintenanceTask)
    expect(task.concernedDataOwnerId).to.equal(patUser.patientId)
    expect(task.newPublicKey).to.equal(ua2hex(await hcpApis.cryptoApi.primitives.RSA.exportKey(newPair.publicKey, 'spki')))
    await hcpApis.icureMaintenanceTaskApi.applyKeyPairUpdate(task)
    // Clear the caches to ensure the user uses the latest version of the exchange keys with the 'give access back' data
    await patApisLost.cryptoApi.forceReload()
    expect((await patApisLost.patientApi.getPatientWithUser(patUser, p2.id!)).note).to.equal(patientNote)
    expect((await patApisLost.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).note).to.equal(heNote)
    checkContactDecrypted(await patApisLost.contactApi.getContactWithUser(patUser, ctc!.id!))
  })
})
