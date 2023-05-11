import { before } from 'mocha'

import 'isomorphic-fetch'

import { IccHelementXApi, IccPatientXApi } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { HealthElement } from '../../icc-api/model/HealthElement'
import { Code } from '../../icc-api/model/Code'
import { User } from '../../icc-api/model/User'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { HealthElementByIdsFilter } from '../../icc-x-api/filters/HealthElementByIdsFilter'
import { FilterChainHealthElement } from '../../icc-api/model/FilterChainHealthElement'

setLocalStorage(fetch)
let env: TestVars

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
    } = await initApi(env, hcp1Username)

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
    const foundHealthElementsUsingPost = await hElementApiForHcp.findHealthElementsByHCPartyAndPatientWithUser(
      hcpUser,
      hcpUser.healthcarePartyId!,
      patient,
      true
    )

    // Then
    assert(foundHealthElements.length == 1, 'Found health elements should be 1')
    assert(foundHealthElements[0].id == createdHealthElement.id, 'Found health element should be the same as the created one')

    assert(foundHealthElementsUsingPost.length == 1, 'Found health elements using POST should be 1')
    assert(foundHealthElementsUsingPost[0].id == createdHealthElement.id, 'Found health element using POST should be the same as the created one')
  })

  it('filter healthcare element result should return same output by id', async () => {
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
    const healthElementById = await hElementApiForHcp.getHealthElementWithUser(hcpUser, createdHealthElement.id)
    const healthElementByFilter = await hElementApiForHcp.filterByWithUser(
      hcpUser,
      undefined,
      undefined,
      new FilterChainHealthElement({
        filter: new HealthElementByIdsFilter({
          ids: [createdHealthElement.id!],
          healthcarePartyId: hcpUser.healthcarePartyId!,
        }),
      })
    )

    // Then
    // expect(foundHealthElements).to.have.length(1)
    // expect(foundHealthElements[0].id).to.equal(createdHealthElement.id)
    assert(healthElementByFilter.rows?.length == 1, 'Found health elements should be 1')
    assert(healthElementByFilter.rows[0].id == createdHealthElement.id, 'Found health element should be the same as the created one')

    assert(!!healthElementById.note, 'Health element should have a note')

    assert(
      JSON.stringify(healthElementByFilter.rows[0]) === JSON.stringify(healthElementById),
      'Found health elements by id should match the one found by filter'
    )
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const samplePatient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, { firstName: 'Gigio', lastName: 'Bagigio' })
    )
    const encryptedField = 'Something encrypted'
    const entity = await api1.healthcareElementApi.createHealthElementWithUser(
      user1,
      await api1.healthcareElementApi.newInstance(user1, samplePatient, { note: encryptedField })
    )
    expect(entity.note).to.be.equal(encryptedField)
    await api2.healthcareElementApi
      .getHealthElementWithUser(user2, entity.id)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.healthcareElementApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.healthcareElementApi.getHealthElementWithUser(user2, entity.id)
    expect(retrieved.note).to.be.equal(encryptedField)
    expect((await api2.healthcareElementApi.decryptPatientIdOf(retrieved))[0]).to.equal(samplePatient.id)
  })
})
