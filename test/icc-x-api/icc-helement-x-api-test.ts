import {before} from 'mocha'

import 'isomorphic-fetch'

import {LocalStorage} from 'node-localstorage'
import * as os from 'os'
import {Api, IccHelementXApi, IccPatientXApi} from '../../icc-x-api'
import {crypto} from '../../node-compat'
import {Patient} from '../../icc-api/model/Patient'
import {assert} from 'chai'
import {randomUUID} from 'crypto'
import {TestUtils} from '../utils/test_utils'
import {HealthElement} from '../../icc-api/model/HealthElement'
import {Code} from '../../icc-api/model/Code'
import {User} from '../../icc-api/model/User'
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

async function createPatient(patientApiForHcp: IccPatientXApi, hcpUser: User) {
  return patientApiForHcp.createPatientWithUser(
    hcpUser,
    await patientApiForHcp.newInstance(
      hcpUser,
      new Patient({
        id: randomUUID(),
        firstName: 'John',
        lastName: 'Snow',
        note: 'Winter is coming',
      })
    )
  )
}

function healthElementToCreate(hElementApiForHcp: IccHelementXApi, hcpUser: User, patient: Patient) {
  return hElementApiForHcp.newInstance(
    hcpUser,
    patient,
    new HealthElement({
      id: randomUUID(),
      codes: [new Code({ system: 'LOINC', code: '95209', version: '3' })],
      note: 'SARS-V2',
    }),
    true
  )
}

describe('icc-helement-x-api Tests', () => {
  it('CreateHealthElementWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const hElementToCreate = await healthElementToCreate(hElementApiForHcp, hcpUser, patient)

    // When
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(hcpUser, hElementToCreate)

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note == hElementToCreate.note)
    assert(readHealthElement.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.cryptedForeignKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('ModifyHealthElementWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    const modifiedHealthElement = await hElementApiForHcp.modifyHealthElementWithUser(hcpUser, {
      ...createdHealthElement,
      note: 'SARS-V2 (COVID-19)',
    })

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note != createdHealthElement.note)
    assert(readHealthElement.note == modifiedHealthElement.note)
    assert(readHealthElement.delegations![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.encryptionKeys![hcpUser.healthcarePartyId!].length > 0)
    assert(readHealthElement.cryptedForeignKeys![hcpUser.healthcarePartyId!].length > 0)
  })

  it('findHealthElementsByHCPartyAndPatientWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    const foundHealthElements = await hElementApiForHcp.findHealthElementsByHCPartyAndPatientWithUser(hcpUser, hcpUser.healthcarePartyId!, patient)

    // Then
    assert(foundHealthElements.length == 1)
    assert(foundHealthElements[0].id == createdHealthElement.id)
  })
})
