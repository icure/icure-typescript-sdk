import {
  getApiAndAddPrivateKeysForUser,
  getEnvironmentInitializer,
  getEnvVariables,
  hcp1Username,
  hcp2Username,
  setLocalStorage,
  TestVars,
} from '../utils/test_utils'
import { before, describe, it } from 'mocha'
import { expect } from 'chai'

setLocalStorage(fetch)

let env: TestVars | undefined

describe('Error reporting', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it(`should export full and minimal data`, async () => {
    const api1 = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username])
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await getApiAndAddPrivateKeysForUser(env!.iCureUrl, env!.dataOwnerDetails[hcp2Username])
    const user2 = await api2.userApi.getCurrentUser()
    const createdPatient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, { firstName: 'SecretJohn', lastName: 'SecretDoe', note: 'SecretNote' }, [user2.healthcarePartyId!])
    )
    const hcp1 = await api1.healthcarePartyApi.getHealthcareParty(user1.healthcarePartyId!)
    const hcp2 = await api2.healthcarePartyApi.getHealthcareParty(user2.healthcarePartyId!)
    const retrievedPatient = await api2.patientApi.getPatientWithUser(user2, createdPatient.id!)
    expect(retrievedPatient.note).to.equal('SecretNote')
    const secretIds = (await api2.cryptoApi.extractKeysFromDelegationsForHcpHierarchy(hcp2.id!, retrievedPatient.id, retrievedPatient.delegations))
      .extractedKeys
    const encryptionKeys = (
      await api2.cryptoApi.extractKeysFromDelegationsForHcpHierarchy(hcp2.id!, retrievedPatient.id, retrievedPatient.encryptionKeys)
    ).extractedKeys
    expect(secretIds).to.not.be.empty
    expect(encryptionKeys).to.not.be.empty
    let cachedMinimalData: undefined | object = undefined
    let cachedFullData: undefined | object = undefined
    api2.cryptoApi.saveErrorReportCallback = async (report) => {
      cachedMinimalData = report.minimalData
      cachedFullData = report.fullData
    }
    const description = 'Some test error'
    await api2.cryptoApi.reportError(description, [retrievedPatient], user2.healthcarePartyId!)
    expect(cachedMinimalData).to.not.be.undefined
    expect(cachedFullData).to.not.be.undefined
    const minimalJson = JSON.stringify(cachedMinimalData)
    const fullJson = JSON.stringify(cachedFullData)
    expect(minimalJson).includes(description)
    expect(fullJson).includes(description)
    expect(fullJson).includes('SecretJohn')
    expect(fullJson).includes('SecretDoe')
    expect(fullJson).includes('SecretNote')
    expect(minimalJson).does.not.include('SecretJohn')
    expect(minimalJson).does.not.include('SecretDoe')
    expect(minimalJson).does.not.include('SecretNote')
    secretIds.forEach((secretId) => {
      expect(fullJson).includes(secretId)
      expect(minimalJson).does.not.include(secretId)
    })
    encryptionKeys.forEach((encryptionKey) => {
      expect(fullJson).includes(encryptionKey)
      expect(minimalJson).does.not.include(encryptionKey)
    })
    expect(fullJson).includes(user1.healthcarePartyId)
    expect(fullJson).includes(user2.healthcarePartyId)
    expect(fullJson).includes(hcp1.firstName)
    expect(fullJson).includes(hcp2.firstName)
    expect(fullJson).includes(hcp1.publicKey)
    expect(fullJson).includes(hcp2.publicKey)
    expect(minimalJson).includes(user1.healthcarePartyId)
    expect(minimalJson).includes(user2.healthcarePartyId)
    expect(minimalJson).does.not.include(hcp1.firstName)
    expect(minimalJson).does.not.include(hcp2.firstName)
    expect(minimalJson).includes(hcp1.publicKey)
    expect(minimalJson).includes(hcp2.publicKey)
  })
})
