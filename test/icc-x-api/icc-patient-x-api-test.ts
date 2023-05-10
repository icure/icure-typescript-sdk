import { before } from 'mocha'

import 'isomorphic-fetch'

import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, hcp3Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

describe('icc-x-patient-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('CreatePatientWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patientToCreate = await patientApiForHcp.newInstance(
      hcpUser,
      new Patient({
        id: randomUUID(),
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })
    )

    // When
    const createdPatient = await patientApiForHcp.createPatientWithUser(hcpUser, patientToCreate)

    // Then
    const readPatient = await patientApiForHcp.getPatientWithUser(hcpUser, createdPatient.id!)
    assert(readPatient != null)
    assert(readPatient.id != null)
    assert(readPatient.note == patientToCreate.note)
    assert(readPatient.firstName == patientToCreate.firstName)
    assert(readPatient.lastName == patientToCreate.lastName)
    assert(readPatient.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readPatient.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('Merge patients should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const api3 = await initApi(env!, hcp3Username)
    const user3 = await api3.userApi.getCurrentUser()
    const mergedFirstName = 'Gigio'
    const mergedLastName = 'Bagigio'
    const mergedAlias = 'Luigio'
    const mergedNote = 'A secret note'
    const patientFrom = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(
        user1,
        {
          firstName: mergedFirstName,
          lastName: 'From',
          note: 'A',
        },
        { additionalDelegates: { [user2.healthcarePartyId!]: 'WRITE' } }
      )
    )
    const patientFromSecretIds = await api1.patientApi.decryptSecretIdsOf(patientFrom)
    expect(patientFromSecretIds).to.have.lengthOf(1)
    const patientInto = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(
        user1,
        {
          firstName: 'Into',
          lastName: mergedLastName,
          note: 'B',
        },
        { additionalDelegates: { [user3.healthcarePartyId!]: 'WRITE' } }
      )
    )
    const patientIntoSecretIds = await api1.patientApi.decryptSecretIdsOf(patientInto)
    expect(patientFromSecretIds).to.have.lengthOf(1)
    expect(patientIntoSecretIds[0]).to.not.equal(patientFromSecretIds[0])
    const mergedInto = {
      ...patientInto,
      firstName: mergedFirstName,
      lastName: mergedLastName,
      alias: mergedAlias,
      note: mergedNote,
    }
    const mergedPatient = await api1.patientApi.mergePatients(patientFrom, mergedInto)
    expect(mergedPatient.firstName).to.equal(mergedFirstName)
    expect(mergedPatient.lastName).to.equal(mergedLastName)
    expect(mergedPatient.alias).to.equal(mergedAlias)
    expect(mergedPatient.note).to.equal(mergedNote)
    expect(await api1.patientApi.decryptSecretIdsOf(mergedPatient)).to.have.members([...patientFromSecretIds, ...patientIntoSecretIds])
    const retrievedByDelegateWithAccessToInto = await api3.patientApi.getPatientWithUser(user3, patientInto.id!)
    expect(retrievedByDelegateWithAccessToInto.firstName).to.equal(mergedFirstName)
    expect(retrievedByDelegateWithAccessToInto.lastName).to.equal(mergedLastName)
    expect(retrievedByDelegateWithAccessToInto.alias).to.equal(mergedAlias)
    expect(retrievedByDelegateWithAccessToInto.note).to.equal(mergedNote)
    expect(await api3.patientApi.decryptSecretIdsOf(retrievedByDelegateWithAccessToInto)).to.have.members(patientIntoSecretIds)
    const retrievedByDelegateWithAccessToFrom = await api2.patientApi.getPatientWithUser(user2, patientInto.id!)
    expect(retrievedByDelegateWithAccessToFrom.firstName).to.equal(mergedFirstName)
    expect(retrievedByDelegateWithAccessToFrom.lastName).to.equal(mergedLastName)
    expect(retrievedByDelegateWithAccessToFrom.alias).to.equal(mergedAlias)
    expect(retrievedByDelegateWithAccessToFrom.note).to.be.undefined // No access to new encryption key yet
    expect(await api2.patientApi.decryptSecretIdsOf(retrievedByDelegateWithAccessToFrom)).to.have.members(patientFromSecretIds)
  })
})
