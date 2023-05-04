/* make node behave */
import 'isomorphic-fetch'
import { IccPatientApi } from '../../../icc-api'
import { expect } from 'chai'
import 'mocha'

import { Patient } from '../../../icc-api/model/Patient'
import { createHcpHierarchyApis, getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { BasicAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

let env: TestVars

setLocalStorage(fetch)

describe('Create a patient from scratch', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should create a patient in the database', async () => {
    const api = await initApi(env, hcp1Username)
    const user = await api.userApi.getCurrentUser()

    const note = 'A secured note that is encrypted'
    const patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(
        user,
        new Patient({
          lastName: 'Biden',
          firstName: 'Joe',
          note,
        })
      )
    )
    expect(patient.note).to.equal(note)

    console.log(
      `Created patient (decrypted): ${patient.id}: ${patient.firstName} ${patient.lastName} [note:${patient.note}, encryptedSelf:${patient.encryptedSelf}]`
    )

    const fetched = await api.patientApi.getPatientWithUser(user, patient.id)
    console.log(
      `Fetched patient (decrypted): ${fetched.id}: ${fetched.firstName} ${fetched.lastName} [note:${fetched.note}, encryptedSelf:${fetched.encryptedSelf}]`
    )
    expect(fetched.id).to.equal(patient.id)
    expect(fetched.note).to.equal(note)

    const fetchedWithoutDecryption = await new IccPatientApi(
      env.iCureUrl,
      {},
      new BasicAuthenticationProvider(env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password),
      fetch as any
    ).getPatient(patient.id)

    console.log(
      `Fetched patient (encrypted):${fetchedWithoutDecryption.id}: ${fetchedWithoutDecryption.firstName} ${fetchedWithoutDecryption.lastName} [note: ${fetchedWithoutDecryption.note}]`
    )
    expect(fetchedWithoutDecryption.id).to.equal(patient.id)
    expect(fetchedWithoutDecryption.note).to.be.undefined
  })
})

describe('Init confidential delegation in patient', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should return a patient with a confidential delegation', async () => {
    const { grandApi, grandUser, childApi, childUser, parentApi, parentUser, child2Api, child2User } = await createHcpHierarchyApis(env!)
    const others = [
      { api: child2Api, user: child2User },
      { api: parentApi, user: parentUser },
      { api: grandApi, user: grandUser },
    ]

    const note = 'Some note'
    const pat = await childApi.patientApi.createPatientWithUser(
      childUser,
      await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe', note })
    )

    // All parents and siblings should have access to the decrypted data and to the initial secret id
    expect(await childApi.patientApi.decryptSecretIdsOf(pat)).to.have.length(1)
    expect((await childApi.patientApi.getPatientWithUser(childUser, pat.id)).note).to.equal(note)
    const originalSecretId = (await childApi.patientApi.decryptSecretIdsOf(pat))[0]
    for (const { api, user } of others) {
      expect(await api.patientApi.decryptSecretIdsOf(pat)).to.have.length(1)
      expect((await api.patientApi.decryptSecretIdsOf(pat))[0]).to.equal(originalSecretId)
      expect((await api.patientApi.getPatientWithUser(user, pat.id)).note).to.equal(note)
    }

    // Initially there shouldn't be any secret confidential secret id
    expect(await childApi.patientApi.decryptConfidentialSecretIdsOf(pat)).to.be.empty

    // Now create a confidential delegation
    const patWithConfidential = await childApi.patientApi.initConfidentialSecretId(pat, childUser)

    // Confidential secret id should be different from the original secret id
    const confidentialDelegationKeys = await childApi.patientApi.decryptConfidentialSecretIdsOf(patWithConfidential)
    const nonConfidentialDelegationKeys = await childApi.patientApi.decryptNonConfidentialSecretIdsOf(patWithConfidential)
    expect(confidentialDelegationKeys).to.have.length(1)
    expect(nonConfidentialDelegationKeys).to.have.length(1)
    expect(confidentialDelegationKeys[0]).to.not.equal(nonConfidentialDelegationKeys)
    expect(nonConfidentialDelegationKeys[0]).to.equal(originalSecretId)

    // Child has access to confidential and not confidential secret ids.
    const childSecretIds = await childApi.patientApi.decryptSecretIdsOf(patWithConfidential)
    expect(childSecretIds).to.have.length(2)
    expect(childSecretIds).to.have.contain(nonConfidentialDelegationKeys[0])
    expect(childSecretIds).to.have.contain(confidentialDelegationKeys[0])

    // All parents and siblings should have access to the decrypted data even after initialising confidential delegations...
    expect((await childApi.patientApi.getPatientWithUser(childUser, pat.id)).note).to.equal(note)
    for (const { api, user } of others) {
      expect((await api.patientApi.getPatientWithUser(user, pat.id)).note).to.equal(note)
    }

    // ...but not to the confidential secret id
    for (const { api } of others) {
      const secretIds = await api.patientApi.decryptSecretIdsOf(patWithConfidential)
      expect(secretIds).to.have.length(1)
      expect(secretIds).to.contain(nonConfidentialDelegationKeys[0])
    }

    // If a secret delegation is already available there is no need to create a new one
    const patWithConfidentialAgain = await childApi.patientApi.initConfidentialSecretId(patWithConfidential, childUser)
    expect(patWithConfidentialAgain.rev).to.equal(patWithConfidentialAgain.rev)
    expect(await childApi.patientApi.decryptSecretIdsOf(patWithConfidentialAgain)).to.have.length(2)

    // Different users will have different confidential secret ids...
    expect(await child2Api.patientApi.decryptConfidentialSecretIdsOf(patWithConfidential)).to.be.empty
    const patWithMoreConfidentialIds = await child2Api.patientApi.initConfidentialSecretId(patWithConfidential, child2User)

    // ...child continues to know the same secret ids...
    const childSecretIdsRepeat = await childApi.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)
    expect(childSecretIdsRepeat).to.have.length(2)
    expect(childSecretIdsRepeat).to.have.contain(nonConfidentialDelegationKeys[0])
    expect(childSecretIdsRepeat).to.have.contain(confidentialDelegationKeys[0])

    // ...but child2 now also knows a different secret id...
    const child2secretIds = await child2Api.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)
    const child2confidential = await child2Api.patientApi.decryptConfidentialSecretIdsOf(patWithMoreConfidentialIds)
    expect(child2confidential).to.have.length(1)
    expect(child2confidential[0]).to.not.equal(confidentialDelegationKeys[0])
    expect(child2confidential[0]).to.not.equal(nonConfidentialDelegationKeys[0])
    expect(child2secretIds).to.have.length(2)
    expect(child2secretIds).to.contain(nonConfidentialDelegationKeys[0])
    expect(child2secretIds).to.contain(child2confidential[0])

    // ...and their parents still don't know them
    expect(await grandApi.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)).to.have.length(1)
    expect(await grandApi.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)).to.have.contain(nonConfidentialDelegationKeys[0])
    expect(await parentApi.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)).to.have.length(1)
    expect(await parentApi.patientApi.decryptSecretIdsOf(patWithMoreConfidentialIds)).to.have.contain(nonConfidentialDelegationKeys[0])
  })
})

describe('Test that contact information can be decrypted', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should return a contact with decrypted information', async () => {
    const { grandApi, grandUser, childApi, childUser, parentApi, parentUser, child2Api, child2User } = await createHcpHierarchyApis(env!)
    const allApis = [
      { api: childApi, user: childUser },
      { api: child2Api, user: child2User },
      { api: parentApi, user: parentUser },
      { api: grandApi, user: grandUser },
    ]

    const pat = await childApi.patientApi.createPatientWithUser(
      childUser,
      await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    )
    const idFlat = childApi.cryptoApi.primitives.randomUuid()
    const idCompound = childApi.cryptoApi.primitives.randomUuid()
    const idSalut = childApi.cryptoApi.primitives.randomUuid()
    const idAtoi = childApi.cryptoApi.primitives.randomUuid()
    const instance = await childApi.contactApi.newInstance(childUser, pat, {
      services: [
        {
          id: idFlat,
          content: { fr: { stringValue: 'Salut' }, nl: { stringValue: 'Halo' } },
        },
        {
          id: idCompound,
          content: {
            fr: {
              compoundValue: [
                { id: idSalut, content: { fr: { stringValue: 'Salut' } } },
                { id: idAtoi, content: { fr: { stringValue: 'à toi' } } },
              ],
            },
          },
        },
      ],
    })
    const created = await childApi.contactApi.createContactWithUser(childUser, instance)
    const createdFlat = created!.services!.find((x) => x.id === idFlat)!
    const createdCompound = created!.services!.find((x) => x.id === idCompound)!
    const createdSalut = createdCompound.content!.fr.compoundValue!.find((x) => x.id === idSalut)!
    const createdAtoi = createdCompound.content!.fr.compoundValue!.find((x) => x.id === idAtoi)!

    for (const { api, user } of allApis) {
      console.log('Trying with user: ' + user.login)
      const check = await api.contactApi.getContactWithUser(user, created!.id!)
      const checkFlat = check!.services!.find((x) => x.id == idFlat)!
      const checkCompound = check!.services!.find((x) => x.id == idCompound)!
      const checkSalut = checkCompound.content!.fr.compoundValue!.find((x) => x.id === idSalut)!
      const checkAtoi = checkCompound.content!.fr.compoundValue!.find((x) => x.id === idAtoi)!

      expect(checkFlat).to.not.be.undefined
      expect(checkFlat).to.not.be.null
      expect(checkSalut).to.not.be.undefined
      expect(checkSalut).to.not.be.null
      expect(checkAtoi).to.not.be.undefined
      expect(checkAtoi).to.not.be.null

      expect(checkFlat.content!.fr.stringValue).to.equal(createdFlat!.content!.fr.stringValue)
      expect(checkFlat.content!.nl.stringValue).to.equal(createdFlat!.content!.nl.stringValue)
      expect(checkFlat.content!.encryptedSelf).to.not.be.null

      expect(checkSalut.content!.fr.stringValue).to.equal(createdSalut.content!.fr.stringValue)
      expect(checkSalut.encryptedSelf).to.not.be.null

      expect(checkAtoi.content!.fr.stringValue).to.equal(createdAtoi.content!.fr.stringValue)
      expect(checkAtoi.encryptedSelf).to.not.be.null
    }
  })
})

describe('test that confidential helement information cannot be retrieved at MH level', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should find the confidential data only when logged as the user', async () => {
    const { grandApi, grandUser, childApi, childUser, parentApi, parentUser, child2Api, child2User } = await createHcpHierarchyApis(env!)
    const others = [
      { api: child2Api, user: child2User },
      { api: parentApi, user: parentUser },
      { api: grandApi, user: grandUser },
    ]

    const pat = await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    const modifiedPatient = (await childApi.patientApi.initConfidentialSecretId(pat, childUser))!

    const confidentialHe = await childApi.healthcareElementApi.createHealthElementWithUser(
      childUser,
      await childApi.healthcareElementApi.newInstance(childUser, modifiedPatient, { descr: 'Confidential info' }, { confidential: true })
    )

    const retrievedHesAsUser = await childApi.healthcareElementApi.findBy(childUser.healthcarePartyId!, modifiedPatient)
    expect(retrievedHesAsUser.length).to.equal(1, 'User should see its confidential data')

    for (const { api, user } of others) {
      const retrievedHesAsMh = await api.healthcareElementApi.findBy(user.healthcarePartyId!, modifiedPatient)
      expect(retrievedHesAsMh.length).to.equal(0, 'MH should not see confidential data')
      let failedToRetrieve = false
      try {
        await api.healthcareElementApi.getHealthElementWithUser(user, confidentialHe.id!)
      } catch (e) {
        console.log(e)
        failedToRetrieve = true
      }
      expect(failedToRetrieve).to.equal(true, 'MH should fail to retrieve confidential data')
      // Even if in some way I could get the contact I should not be able to decrypt it
      expect(await api.cryptoApi.xapi.encryptionKeysOf({ entity: confidentialHe!, type: 'HealthElement' }, undefined)).to.have.length(0)
    }
  })
})

describe('test that confidential contact information cannot be retrieved at MH level', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should find the confidential data only when logged as the user', async () => {
    const { grandApi, grandUser, childApi, childUser, parentApi, parentUser, child2Api, child2User } = await createHcpHierarchyApis(env!)
    const others = [
      { api: child2Api, user: child2User },
      { api: parentApi, user: parentUser },
      { api: grandApi, user: grandUser },
    ]

    const pat = await childApi.patientApi.newInstance(childUser, { firstName: 'John', lastName: 'Doe' })
    const modifiedPatient = (await childApi.patientApi.initConfidentialSecretId(pat, childUser))!

    const confidentialCtc = await childApi.contactApi.createContactWithUser(
      childUser,
      await childApi.contactApi.newInstance(
        childUser,
        modifiedPatient,

        { descr: 'Confidential info', services: [], subContacts: [] },
        { confidential: true }
      )
    )

    await childApi.contactApi.createContactWithUser(
      childUser,
      await childApi.contactApi.newInstance(
        childUser,
        modifiedPatient,
        { descr: 'Non confidential info', services: [], subContacts: [] },
        { confidential: false }
      )
    )

    const retrievedCtcsAsUser = await childApi.contactApi.findBy(childUser.healthcarePartyId!, modifiedPatient)
    expect(retrievedCtcsAsUser.length).to.equal(2, 'User should see its confidential data')

    for (const { api, user } of others) {
      const retrievedCtcsAsMh = await api.contactApi.findBy(user.healthcarePartyId!, modifiedPatient)
      expect(retrievedCtcsAsMh.length).to.equal(1, 'MH should not see confidential data')
      // Even if in some way I could get the contact id I should not be able to get it
      let failedToRetrieve = false
      try {
        await api.contactApi.getContactWithUser(user, confidentialCtc!.id!)
      } catch (e) {
        console.log(e)
        failedToRetrieve = true
      }
      expect(failedToRetrieve).to.equal(true, 'MH should fail to retrieve confidential data')
      // Even if in some way I could get the contact I should not be able to decrypt it
      expect(await api.cryptoApi.xapi.encryptionKeysOf({ entity: confidentialCtc!, type: 'Contact' }, undefined)).to.have.length(0)
    }
  })
})
