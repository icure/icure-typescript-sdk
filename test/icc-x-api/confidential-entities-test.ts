import { createHcpHierarchyApis, getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
setLocalStorage(fetch)

var env: TestVars

describe('test confidential helement', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('confidential entity should be accessible only to user, non confidential should be accessible also to parent', async () => {
    // Use only the top of the hierarchy for simplicity of the test
    const { parentApi: childApi, parentUser: childUser, grandApi: parentApi, grandUser: parentUser } = await createHcpHierarchyApis(env!)

    const pat = await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    const modifiedPatient = (await childApi.patientApi.initConfidentialSecretId(pat, childUser))!

    const patientSecretIdsForParent = await parentApi.patientApi.decryptSecretIdsOf(modifiedPatient)
    const patientSecretIdsForChild = await childApi.patientApi.decryptSecretIdsOf(modifiedPatient)
    expect(patientSecretIdsForParent).to.have.length(1)
    expect(patientSecretIdsForChild).to.have.length(2)
    expect(patientSecretIdsForChild).to.contain(patientSecretIdsForParent[0])
    expect(patientSecretIdsForChild[0]).to.not.eq(patientSecretIdsForChild[1])

    const confidentialHe = await childApi.healthcareElementApi.createHealthElementWithUser(
      childUser,
      await childApi.healthcareElementApi.newInstance(childUser, modifiedPatient, { descr: 'Confidential info' }, { confidential: true })
    )
    expect(confidentialHe.descr).to.eq('Confidential info')
    const nonConfidentialHe = await childApi.healthcareElementApi.createHealthElementWithUser(
      childUser,
      await childApi.healthcareElementApi.newInstance(childUser, modifiedPatient, { descr: 'Non confidential info' }, { confidential: false })
    )
    expect(nonConfidentialHe.descr).to.eq('Non confidential info')

    const retrievedHesAsUser = await childApi.healthcareElementApi.findBy(childUser.healthcarePartyId!, modifiedPatient)
    expect(retrievedHesAsUser.length).to.equal(2, 'Child should see confidential and non-confidential data created by him')
    expect(retrievedHesAsUser.map((he) => he.id)).to.have.members([confidentialHe.id, nonConfidentialHe.id])
    const retrievedConfidential = retrievedHesAsUser.find((he) => he.id === confidentialHe.id)
    const retrievedNonConfidential = retrievedHesAsUser.find((he) => he.id === nonConfidentialHe.id)
    expect(retrievedConfidential).to.deep.eq(confidentialHe)
    expect(retrievedNonConfidential).to.deep.eq(nonConfidentialHe)

    const retrievedHesAsParent = await parentApi.healthcareElementApi.findBy(parentUser.healthcarePartyId!, modifiedPatient)
    expect(retrievedHesAsParent.length).to.equal(1, 'Parent should not see confidential data, but only non-confidential data created by child')
    expect(retrievedHesAsParent[0]).to.deep.eq(nonConfidentialHe)
    let failedToRetrieve = false
    try {
      await parentApi.healthcareElementApi.getHealthElementWithUser(parentUser, confidentialHe.id!)
    } catch (e) {
      console.log(e)
      failedToRetrieve = true
    }
    expect(failedToRetrieve).to.equal(true, 'Parent should fail to retrieve confidential data')
    // Even if in some way I could get the contact I should not be able to decrypt it
    expect(await parentApi.cryptoApi.xapi.encryptionKeysOf({ entity: confidentialHe!, type: 'HealthElement' }, undefined)).to.have.length(0)
  })

  it('creation of confidential data should fail if no confidential secret id is available for patient', async () => {
    // Use only the top of the hierarchy for simplicity of the test
    const { parentApi: childApi, parentUser: childUser, grandApi: parentApi, grandUser: parentUser } = await createHcpHierarchyApis(env!)

    const pat = await childApi.patientApi.createPatientWithUser(
      childUser,
      await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    )
    let failed = false
    try {
      await childApi.healthcareElementApi.newInstance(childUser, pat, { descr: 'Confidential info' }, { confidential: true })
    } catch {
      failed = true
    }
    expect(failed).to.equal(true, 'Creation of confidential data should fail if no confidential secret id is available for patient')
  })

  it('creation of non-confidential data should fail if no secret id is available for parent', async () => {
    // Use only the top of the hierarchy for simplicity of the test
    const { parentApi: childApi, parentUser: childUser, grandApi: parentApi, grandUser: parentUser } = await createHcpHierarchyApis(env!, false)

    const pat = await childApi.patientApi.createPatientWithUser(
      childUser,
      await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    )
    let failed = false
    try {
      await childApi.healthcareElementApi.newInstance(childUser, pat, { descr: 'Confidential info' }, { confidential: false })
    } catch {
      failed = true
    }
    expect(failed).to.equal(true, 'Creation of confidential data should fail if no non-confidential secret id is available for patient')
  })

  it('confidential or non-confidential is irrelevant if api is initialised without parent key initialisation: data created by user is only accessible to him', async () => {
    // Use only the top of the hierarchy for simplicity of the test
    const { parentApi: childApi, parentUser: childUser, grandApi: parentApi, grandUser: parentUser } = await createHcpHierarchyApis(env!, false, true)

    const pat = await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })

    const confidentialHe = await childApi.healthcareElementApi.createHealthElementWithUser(
      childUser,
      await childApi.healthcareElementApi.newInstance(childUser, pat, { descr: 'Confidential info' }, { confidential: true })
    )
    expect(confidentialHe.descr).to.eq('Confidential info')
    const nonConfidentialHe = await childApi.healthcareElementApi.createHealthElementWithUser(
      childUser,
      await childApi.healthcareElementApi.newInstance(childUser, pat, { descr: 'Non confidential info' }, { confidential: false })
    )
    expect(nonConfidentialHe.descr).to.eq('Non confidential info')

    const retrievedHesAsUser = await childApi.healthcareElementApi.findBy(childUser.healthcarePartyId!, pat)
    expect(retrievedHesAsUser.length).to.equal(2, 'Child should see confidential and non-confidential data created by him')
    expect(retrievedHesAsUser.map((he) => he.id)).to.have.members([confidentialHe.id, nonConfidentialHe.id])
    const retrievedConfidential = retrievedHesAsUser.find((he) => he.id === confidentialHe.id)
    const retrievedNonConfidential = retrievedHesAsUser.find((he) => he.id === nonConfidentialHe.id)
    expect(retrievedConfidential).to.deep.eq(confidentialHe)
    expect(retrievedNonConfidential).to.deep.eq(nonConfidentialHe)

    await parentApi.patientApi.decryptSecretIdsOf(pat)
  })
})
