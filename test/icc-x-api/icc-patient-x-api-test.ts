import { before } from 'mocha'

import 'isomorphic-fetch'

import { Patient } from '../../icc-api/model/Patient'
import { assert, expect } from 'chai'
import { randomBytes, randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, hcp3Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { EntityWithDelegationTypeName, ua2b64 } from '../../icc-x-api'

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
    expect(
      await cryptoApiForHcp.xapi.encryptionKeysOf({ entity: readPatient, type: EntityWithDelegationTypeName.Patient }, undefined)
    ).to.have.length(1)
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

  it('Patient picture should be automatically decoded from base64 on initialisation.', async () => {
    const pictureAB = randomBytes(100)
    const pictureBase64 = ua2b64(pictureAB)
    const patient = new Patient({ picture: pictureBase64 })
    expect(patient.picture).to.not.be.undefined
    expect(patient.picture instanceof ArrayBuffer || ArrayBuffer.isView(patient.picture)).to.be.true
    const decodedPicture = new Uint8Array(patient.picture!)
    expect(decodedPicture).to.have.length(pictureAB.length)
    for (let i = 0; i < pictureAB.length; i++) {
      expect(decodedPicture[i]).to.equal(pictureAB[i])
    }
  })

  it('Creating a new Patient instance using a patient with decoded picture should not lose the picture data', async () => {
    const pictureAB = randomBytes(100)
    const patient = new Patient({ picture: new Uint8Array(pictureAB) })
    expect(patient.picture).to.not.be.undefined
    expect(patient.picture instanceof ArrayBuffer || ArrayBuffer.isView(patient.picture)).to.be.true
    const decodedPicture = new Uint8Array(patient.picture!)
    expect(decodedPicture).to.have.length(pictureAB.length)
    for (let i = 0; i < pictureAB.length; i++) {
      expect(decodedPicture[i]).to.equal(pictureAB[i])
    }
  })

  it('A Patient with picture data should be created and retrieved correctly', async () => {
    const pictureAB = randomBytes(100)
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()
    const patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'Giovanni', lastName: 'Giorgio', picture: new Uint8Array(pictureAB) })
    )
    expect(patient.picture).to.not.be.undefined
    expect(patient.picture instanceof ArrayBuffer || ArrayBuffer.isView(patient.picture)).to.be.true
    const decodedPicture = new Uint8Array(patient.picture!)
    expect(decodedPicture).to.have.length(pictureAB.length)
    for (let i = 0; i < pictureAB.length; i++) {
      expect(decodedPicture[i]).to.equal(pictureAB[i])
    }
  })

  it('modifyPatientWithUser should preserve the picture data when a picture is passed', async () => {
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()

    // Create a patient without a picture
    const created = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'Giovanni', lastName: 'Giorgio' })
    )
    expect(created.picture).to.be.undefined

    // Modify the patient, adding a picture (stored as an ArrayBuffer, which goes through cloneDeep in modifyPatientAs)
    const pictureAB = randomBytes(100)
    const modified = await api.patientApi.modifyPatientWithUser(user, new Patient({ ...created, picture: new Uint8Array(pictureAB) }))
    assert(modified != null)
    expect(modified!.id).to.equal(created.id)
    expect(modified!.picture).to.not.be.undefined
    expect(modified!.picture instanceof ArrayBuffer || ArrayBuffer.isView(modified!.picture)).to.be.true

    // The returned picture must match the one that was passed in, byte for byte (cloneDeep must not corrupt the ArrayBuffer)
    const modifiedPicture = new Uint8Array(modified!.picture!)
    expect(modifiedPicture).to.have.length(pictureAB.length)
    for (let i = 0; i < pictureAB.length; i++) {
      expect(modifiedPicture[i]).to.equal(pictureAB[i])
    }

    // The picture must survive a round-trip through the backend
    const retrieved = await api.patientApi.getPatientWithUser(user, created.id!)
    expect(retrieved.picture).to.not.be.undefined
    expect(retrieved.picture instanceof ArrayBuffer || ArrayBuffer.isView(retrieved.picture)).to.be.true
    const retrievedPicture = new Uint8Array(retrieved.picture!)
    expect(retrievedPicture).to.have.length(pictureAB.length)
    for (let i = 0; i < pictureAB.length; i++) {
      expect(retrievedPicture[i]).to.equal(pictureAB[i])
    }
  })

  it('modifyPatientWithUser should not mutate the picture of the patient passed as argument', async () => {
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()

    const pictureAB = randomBytes(100)
    const created = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'Giovanni', lastName: 'Giorgio', picture: new Uint8Array(pictureAB) })
    )

    // The input object should be left untouched by the encryption/cloneDeep step during modify
    const input = new Patient({ ...created, note: 'updated note' })
    const inputPictureBefore = new Uint8Array(input.picture!).slice()
    await api.patientApi.modifyPatientWithUser(user, input)
    const inputPictureAfter = new Uint8Array(input.picture!)
    expect(inputPictureAfter).to.have.length(inputPictureBefore.length)
    for (let i = 0; i < inputPictureBefore.length; i++) {
      expect(inputPictureAfter[i]).to.equal(inputPictureBefore[i])
    }
  })

  it('A patient created with v8 + should have no auto-fixed delegations', async () => {
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()
    const patient: Patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(user, { firstName: 'Giovanni', lastName: 'Giorgio', preferredUserId: user.id })
    )
    expect(Object.keys(patient.delegations ?? {}).length == 0).to.be.true
  })
})
