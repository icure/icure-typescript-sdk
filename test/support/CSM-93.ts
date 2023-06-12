import { getEnvironmentInitializer, getEnvVariables, hcp1Username, patUsername, setLocalStorage, TestVars } from '../utils/test_utils'
import { Api, hex2ua, pkcs8ToJwk } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { FilterChainMaintenanceTask } from '../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
setLocalStorage(fetch)

let env: TestVars

describe('CSM-93', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('A patient should be able retrieve existing data after give access back', async function () {
    const hcpCredentials = env.dataOwnerDetails[hcp1Username]
    const hcpApis = await Api(env.iCureUrl, hcpCredentials.user, hcpCredentials.password, webcrypto as any, fetch)
    const hcpUser = await hcpApis.userApi.getCurrentUser()
    await hcpApis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(hcpUser.healthcarePartyId!, pkcs8ToJwk(hex2ua(hcpCredentials.privateKey)))
    const patientCredentials = env.dataOwnerDetails[patUsername]
    const patApis = await Api(env.iCureUrl, patientCredentials.user, patientCredentials.password, webcrypto as any, fetch)
    const patUser = await patApis.userApi.getCurrentUser()
    await patApis.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(patUser.patientId!, pkcs8ToJwk(hex2ua(patientCredentials.privateKey)))
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
        [patUser.patientId!]
      )
    )
    const heNote = 'Another secret note'
    const he = await patApis.healthcareElementApi.createHealthElementWithUser(
      patUser,
      await patApis.healthcareElementApi.newInstance(patUser, p2, { note: heNote }, false, [hcpUser.healthcarePartyId!])
    )
    expect((await hcpApis.patientApi.getPatientWithUser(hcpUser, p2.id!)).note).to.equal(patientNote)
    expect((await patApis.patientApi.getPatientWithUser(patUser, p2.id!)).note).to.equal(patientNote)
    expect((await hcpApis.healthcareElementApi.getHealthElementWithUser(hcpUser, he.id!)).note).to.equal(heNote)
    expect((await patApis.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).note).to.equal(heNote)
    const startTimestamp = new Date().getTime()
    const patApisLost = await Api(env.iCureUrl, patientCredentials.user, patientCredentials.password, webcrypto as any, fetch)
    const newPair = await patApisLost.cryptoApi.addNewKeyPairForOwnerId(patApisLost.maintenanceTaskApi, patUser, patUser.patientId!)
    const retrievedPatientLost = await patApisLost.patientApi.getPatientWithUser(patUser, p2.id!)
    const retrievedHeLost = await patApisLost.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)
    expect(retrievedPatientLost).to.not.be.undefined
    expect(retrievedHeLost).to.not.be.undefined
    expect(retrievedPatientLost.note).to.be.undefined
    expect(retrievedHeLost.note).to.be.undefined
    // The patient had to create a new aes exchange key to share the maintenance task with the hcp:
    // If you don't clear the cache of the hcp he will not be able to decrypt the maintenance task
    hcpApis.cryptoApi.emptyHcpCache(hcpUser.healthcarePartyId!)
    hcpApis.cryptoApi.emptyHcpCache(patUser.patientId!)
    const foundTasks = (
      await hcpApis.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
        hcpUser,
        undefined,
        undefined,
        new FilterChainMaintenanceTask({
          filter: new MaintenanceTaskAfterDateFilter({
            healthcarePartyId: hcpUser.healthcarePartyId!,
            date: startTimestamp - 1000,
          }),
        })
      )
    ).rows
    expect(foundTasks.length).to.equal(1)
    const dataOwnerConcernedId = (foundTasks[0] as MaintenanceTask).properties?.find((prop) => prop.id == 'dataOwnerConcernedId')?.typedValue
      ?.stringValue
    expect(dataOwnerConcernedId).to.not.be.undefined
    expect(dataOwnerConcernedId).to.equal(patUser.patientId)
    const dataOwnerConcernedPubKey = (foundTasks[0] as MaintenanceTask).properties?.find((prop) => prop.id == 'dataOwnerConcernedPubKey')?.typedValue
      ?.stringValue
    expect(dataOwnerConcernedPubKey).to.not.be.undefined
    expect(dataOwnerConcernedPubKey).to.equal(newPair.publicKey)
    await hcpApis.cryptoApi.giveAccessBackTo(hcpUser, dataOwnerConcernedId!, dataOwnerConcernedPubKey!)
    // Clear the caches to ensure the user uses the latest version of the exchange keys with the 'give access back' data
    patApisLost.cryptoApi.emptyHcpCache(hcpUser.healthcarePartyId!)
    patApisLost.cryptoApi.emptyHcpCache(patUser.patientId!)
    expect((await patApis.patientApi.getPatientWithUser(patUser, p2.id!)).note).to.equal(patientNote)
    expect((await patApis.healthcareElementApi.getHealthElementWithUser(patUser, he.id!)).note).to.equal(heNote)
  })
})
