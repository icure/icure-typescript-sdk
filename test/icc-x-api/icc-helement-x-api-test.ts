import { before } from 'mocha'

import 'isomorphic-fetch'

import { IccHelementXApi, IccPatientXApi } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { Code } from '../../icc-api/model/Code'
import { User } from '../../icc-api/model/User'
import initApi = TestUtils.initApi

setLocalStorage(fetch)
let env: TestVars | undefined

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
    { confidential: true }
  )
}

describe('icc-helement-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('CreateHealthElementWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const hElementToCreate = await healthElementToCreate(hElementApiForHcp, hcpUser, patient)

    // When
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(hcpUser, hElementToCreate)

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note == hElementToCreate.note)
    expect(await cryptoApiForHcp.xapi.encryptionKeysOf({ entity: readHealthElement, type: 'Contact' }, undefined)).to.have.length(1)
    const decryptedPatientIds = await hElementApiForHcp.decryptPatientIdOf(readHealthElement)
    expect(decryptedPatientIds).to.have.length(1)
    expect(decryptedPatientIds[0]).to.equal(patient.id)
  })

  it('ModifyHealthElementWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initApi(env!, hcp1Username)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    const newNote = 'SARS-V2 (COVID-19)'
    const modifiedHealthElement = await hElementApiForHcp.modifyHealthElementWithUser(hcpUser, {
      ...createdHealthElement,
      note: newNote,
    })

    // Then
    const readHealthElement = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id!)
    assert(readHealthElement != null)
    assert(readHealthElement.id != null)
    assert(readHealthElement.note != createdHealthElement.note)
    assert(readHealthElement.note == modifiedHealthElement.note)
    assert(readHealthElement.note == newNote)
    expect(await cryptoApiForHcp.xapi.encryptionKeysOf({ entity: readHealthElement, type: 'Contact' }, undefined)).to.have.length(1)
    const decryptedPatientIds = await hElementApiForHcp.decryptPatientIdOf(readHealthElement)
    expect(decryptedPatientIds).to.have.length(1)
    expect(decryptedPatientIds[0]).to.equal(patient.id)
  })

  it('findHealthElementsByHCPartyAndPatientWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient
    const createdHealthElement = await hElementApiForHcp.createHealthElementWithUser(
      hcpUser,
      await healthElementToCreate(hElementApiForHcp, hcpUser, patient)
    )

    // When
    const foundHealthElements = await hElementApiForHcp.findHealthElementsByHCPartyAndPatientWithUser(hcpUser, hcpUser.healthcarePartyId!, patient)

    // Then
    expect(foundHealthElements).to.have.length(1)
    expect(foundHealthElements[0].id).to.equal(createdHealthElement.id)
  })
})
