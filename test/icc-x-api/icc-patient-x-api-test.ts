import { before } from 'mocha'

import 'isomorphic-fetch'

import { Api } from '../../icc-x-api'
import { crypto } from '../../node-compat'
import { Patient } from '../../icc-api/model/Patient'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import initKey = TestUtils.initKey

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
    } = await Api(env.iCureUrl, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, env.dataOwnerDetails[hcp1Username].privateKey)

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
    assert(readPatient.delegations[hcpUser.healthcarePartyId!].length > 0)
    assert(readPatient.encryptionKeys[hcpUser.healthcarePartyId!].length > 0)
  })
})
