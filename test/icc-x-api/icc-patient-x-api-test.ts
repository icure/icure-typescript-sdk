import { before } from 'mocha'

import 'isomorphic-fetch'

import { LocalStorage } from 'node-localstorage'
import * as os from 'os'
import { Api } from '../../icc-x-api'
import { crypto } from '../../node-compat'
import { Patient } from '../../icc-api/model/Patient'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { TestUtils } from '../utils/test_utils'
import initKey = TestUtils.initKey

const tmp = os.tmpdir()
console.log('Saving keys in ' + tmp)
;(global as any).localStorage = new LocalStorage(tmp, 5 * 1024 * 1024 * 1024)
;(global as any).Storage = ''

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcpUserName = process.env.HCP_USERNAME
const hcpPassword = process.env.HCP_PASSWORD
const hcpPrivKey = process.env.HCP_PRIV_KEY

before(() => {
  console.info(`Starting tests using iCure URL : ${iCureUrl}`)

  if (hcpUserName == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_USER_NAME`)
  }

  if (hcpPassword == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PASSWORD`)
  }

  if (hcpPrivKey == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PRIV_KEY`)
  }
})

describe('icc-x-patient-api Tests', () => {
  it('CreatePatientWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

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
