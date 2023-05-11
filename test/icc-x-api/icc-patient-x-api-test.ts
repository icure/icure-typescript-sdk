import { before } from 'mocha'

import 'isomorphic-fetch'

import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
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
    expect(await cryptoApiForHcp.xapi.encryptionKeysOf({ entity: readPatient, type: 'Patient' }, undefined)).to.have.length(1)
    expect(await patientApiForHcp.decryptSecretIdsOf(readPatient)).to.have.length(1)
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const encryptedField = 'Something encrypted'
    const entity = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, { firstName: 'Gigio', lastName: 'Bagigio', note: encryptedField })
    )
    expect(entity.note).to.be.equal(encryptedField)
    const secretIds = await api1.patientApi.decryptSecretIdsOf(entity)
    await api2.patientApi
      .getPatientWithUser(user2, entity.id)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.patientApi.shareWith(user2.healthcarePartyId!, entity, secretIds)
    const retrieved = await api2.patientApi.getPatientWithUser(user2, entity.id)
    expect(retrieved.note).to.be.equal(encryptedField)
    expect(await api2.patientApi.decryptSecretIdsOf(retrieved)).to.have.members(secretIds)
  })
})
