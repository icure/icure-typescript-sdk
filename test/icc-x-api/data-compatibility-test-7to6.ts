import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { before } from 'mocha'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import * as _ from 'lodash'
import { Api as initApiV6, Apis as ApisV6, IccPatientXApi as IccPatientXApiV6, User as UserV6 } from '@icure/apiV6'
import { hex2ua, IcureApi } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { TestKeyStorage, TestStorage } from '../utils/TestStorage'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { IccAccesslogApi, IccCalendarItemApi, IccContactApi, IccHelementApi, IccPatientApi } from '../../icc-api'
import { expect } from 'chai'
import { User } from '../../icc-api/model/User'
import 'isomorphic-fetch'
import { IccMaintenanceTaskApi } from '../../icc-api/api/IccMaintenanceTaskApi'

setLocalStorage(fetch)

let env: TestVars
let apiV6: ApisV6
let apiV7: IcureApi
let userV6: UserV6
let userV7: User
let patient: any

describe('iCure API v6 and v7 (current) should be fully data compatible', async () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    apiV6 = await initApiV6(
      env.iCureUrl + '/rest/v1',
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as any,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage()
    )
    await apiV6.cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
      env.dataOwnerDetails[hcp1Username].dataOwnerId,
      hex2ua(env.dataOwnerDetails[hcp1Username].privateKey)
    )
    apiV6.patientApi = new IccPatientXApiV6( // Want to override encryption keys
      env.iCureUrl + '/rest/v1',
      {},
      apiV6.cryptoApi,
      apiV6.contactApi,
      apiV6.formApi,
      apiV6.healthcareElementApi,
      apiV6.invoiceApi,
      apiV6.documentApi,
      apiV6.healthcarePartyApi,
      apiV6.classificationApi,
      apiV6.dataOwnerApi,
      apiV6.calendarItemApi,
      ['note', 'properties.*.typedValue'],
      apiV6.authApi.authenticationProvider,
      fetch
    )
    apiV7 = await IcureApi.initialise(
      env.iCureUrl,
      { username: env.dataOwnerDetails[hcp1Username].user, password: env.dataOwnerDetails[hcp1Username].password },
      new TestCryptoStrategies({
        publicKey: await apiV6.cryptoApi.RSA.importKey('spki', hex2ua(env.dataOwnerDetails[hcp1Username].publicKey), ['encrypt']),
        privateKey: await apiV6.cryptoApi.RSA.importKey('pkcs8', hex2ua(env.dataOwnerDetails[hcp1Username].privateKey), ['decrypt']),
      }),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
        encryptedFieldsConfig: {
          patient: ['note', 'properties[].typedValue'],
        },
      }
    )
    userV6 = await apiV6.userApi.getCurrentUser()
    userV7 = await apiV7.userApi.getCurrentUser()
    patient = await apiV6.patientApi.createPatientWithUser(userV6, await apiV6.patientApi.newInstance(userV6, { firstName: 'Joe', lastName: 'Dhon' }))
  })

  it('An AccessLog created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccAccesslogApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const accessLogData = {
      detail: 'secret',
      objectId: 'secret2',
      medicalLocationId: 'notSecret',
    }
    const createdV6 = await apiV6.accessLogApi.createAccessLogWithUser(
      userV6,
      await apiV6.accessLogApi.newInstance(userV6, patient, _.cloneDeep(accessLogData))
    )
    const createdV7 = await apiV7.accessLogApi.createAccessLogWithUser(
      userV7,
      await apiV7.accessLogApi.newInstance(userV7, patient, _.cloneDeep(accessLogData))
    )
    ;[
      await apiV6.accessLogApi.getAccessLogWithUser(userV6, createdV7.id), // Read V7 from V6,
      await apiV7.accessLogApi.getAccessLogWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted) => {
      expect(decrypted.medicalLocationId).to.equal(accessLogData.medicalLocationId)
      expect(decrypted.detail).to.equal(accessLogData.detail)
      expect(decrypted.objectId).to.equal(accessLogData.objectId)
    })
    const encryptedV6 = await baseApi.getAccessLog(createdV6.id)
    const encryptedV7 = await baseApi.getAccessLog(createdV7.id)
    ;[encryptedV6, encryptedV7].forEach((encrypted) => {
      expect(encrypted.detail).to.be.undefined
      expect(encrypted.objectId).to.be.undefined
      expect(encrypted.medicalLocationId).to.equal(accessLogData.medicalLocationId)
      expect(encrypted.encryptedSelf).to.not.be.undefined
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
  })

  it('A CalendarItem created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccCalendarItemApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const calendarItemData = {
      patientId: apiV7.cryptoApi.primitives.randomUuid(),
      details: 'Hello',
      placeId: '123',
    }
    const createdV6 = await apiV6.calendarItemApi.createCalendarItemWithHcParty(
      userV6,
      await apiV6.calendarItemApi.newInstance(userV6, _.cloneDeep(calendarItemData))
    )
    const createdV7 = await apiV7.calendarItemApi.createCalendarItemWithHcParty(
      userV7,
      await apiV7.calendarItemApi.newInstance(userV7, _.cloneDeep(calendarItemData))
    )
    ;[
      await apiV6.calendarItemApi.getCalendarItemWithUser(userV6, createdV7.id), // Read V7 from V6,
      await apiV7.calendarItemApi.getCalendarItemWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted) => {
      expect(decrypted.patientId).to.equal(calendarItemData.patientId)
      expect(decrypted.details).to.equal(calendarItemData.details)
      expect(decrypted.placeId).to.equal(calendarItemData.placeId)
    })
    const encryptedV6 = await baseApi.getCalendarItem(createdV6.id)
    const encryptedV7 = await baseApi.getCalendarItem(createdV7.id)
    ;[encryptedV6, encryptedV7].forEach((encrypted) => {
      expect(encrypted.placeId).to.equal(calendarItemData.placeId)
      expect(encrypted.details).to.be.undefined
      expect(encrypted.patientId).to.be.undefined
      expect(encrypted.encryptedSelf).to.not.be.undefined
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
  })

  it('A Contact created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccContactApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const contactData = {
      descr: 'secret',
      location: 'notSecret',
      services: [
        {
          id: 'flat',
          label: 'notSecret1',
          comment: 'notSecret2',
          content: { fr: { stringValue: 'Salut' }, nl: { stringValue: 'Halo' } },
        },
        {
          id: 'compound',
          content: {
            fr: {
              compoundValue: [
                {
                  id: 'nested1',
                  label: 'notSecret3',
                  comment: 'notSecret4',
                  content: { fr: { stringValue: 'A' } },
                },
                {
                  id: 'nested2',
                  label: 'notSecret5',
                  comment: 'notSecret6',
                  content: { fr: { stringValue: 'B' } },
                },
                {
                  id: 'nested3',
                  label: 'notSecret7',
                  comment: 'notSecret8',
                  content: {
                    fr: {
                      compoundValue: [
                        {
                          id: 'deeplyNested',
                          label: 'notSecret9',
                          comment: 'notSecret10',
                          content: { fr: { stringValue: 'C' } },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    }
    const createdV6 = await apiV6.contactApi.createContactWithUser(
      userV6,
      await apiV6.contactApi.newInstance(userV6, patient, _.cloneDeep(contactData))
    )
    const createdV7 = await apiV7.contactApi.createContactWithUser(
      userV7,
      await apiV7.contactApi.newInstance(userV7, patient, _.cloneDeep(contactData))
    )
    ;[
      await apiV6.contactApi.getContactWithUser(userV6, createdV7!.id!), // Read V7 from V6,
      await apiV7.contactApi.getContactWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted: any) => {
      expect(decrypted.descr).to.equal(contactData.descr)
      expect(decrypted.location).to.equal(contactData.location)
      const flat = decrypted.services.find((s: any) => s.id === 'flat')
      expect(flat.label).to.equal(contactData.services[0].label)
      expect(flat.comment).to.equal(contactData.services[0].comment)
      expect(flat.content).to.deep.equal(contactData.services[0].content)
      const compound = decrypted.services.find((s: any) => s.id === 'compound')
      expect(compound.label).to.equal(contactData.services[1].label)
      expect(compound.comment).to.equal(contactData.services[1].comment)
      const nested1 = compound.content.fr.compoundValue.find((s: any) => s.id === 'nested1')
      expect(nested1.label).to.equal(contactData.services[1].content.fr.compoundValue![0].label)
      expect(nested1.comment).to.equal(contactData.services[1].content.fr.compoundValue![0].comment)
      expect(nested1.content).to.deep.equal(contactData.services[1].content.fr.compoundValue![0].content)
      const nested2 = compound.content.fr.compoundValue.find((s: any) => s.id === 'nested2')
      expect(nested2.label).to.equal(contactData.services[1].content.fr.compoundValue![1].label)
      expect(nested2.comment).to.equal(contactData.services[1].content.fr.compoundValue![1].comment)
      expect(nested2.content).to.deep.equal(contactData.services[1].content.fr.compoundValue![1].content)
      const nested3 = compound.content.fr.compoundValue.find((s: any) => s.id === 'nested3')
      expect(nested3.label).to.equal(contactData.services[1].content.fr.compoundValue![2].label)
      expect(nested3.comment).to.equal(contactData.services[1].content.fr.compoundValue![2].comment)
      const deeplyNested = nested3.content.fr.compoundValue.find((s: any) => s.id === 'deeplyNested')
      expect(deeplyNested.label).to.equal(contactData.services[1].content.fr.compoundValue![2].content.fr.compoundValue![0].label)
      expect(deeplyNested.comment).to.equal(contactData.services[1].content.fr.compoundValue![2].content.fr.compoundValue![0].comment)
      expect(deeplyNested.content).to.deep.equal(contactData.services[1].content.fr.compoundValue![2].content.fr.compoundValue![0].content)
    })
    const encryptedV6 = await baseApi.getContact(createdV6.id)
    const encryptedV7 = await baseApi.getContact(createdV7!.id!)
    ;[encryptedV6, encryptedV7].forEach((encrypted: any) => {
      expect(encrypted.descr).to.be.undefined
      expect(encrypted.location).to.equal(contactData.location)
      const flat = encrypted.services!.find((s: any) => s.id === 'flat')!
      expect(flat.label).to.equal(contactData.services[0].label)
      expect(flat.comment).to.equal(contactData.services[0].comment)
      expect(Object.keys(flat.content ?? {})).to.have.length(0)
      expect(flat.encryptedSelf).to.not.be.undefined
      const compound = encrypted.services!.find((s: any) => s.id === 'compound')!
      expect(compound.label).to.equal(contactData.services[1].label)
      expect(compound.comment).to.equal(contactData.services[1].comment)
      expect(compound.encryptedSelf).to.be.undefined
      const nested1 = compound.content!.fr.compoundValue!.find((s: any) => s.id === 'nested1')!
      expect(nested1.label).to.equal(contactData.services[1].content.fr.compoundValue![0].label)
      expect(nested1.comment).to.equal(contactData.services[1].content.fr.compoundValue![0].comment)
      expect(Object.keys(nested1.content ?? {})).to.have.length(0)
      expect(nested1.encryptedSelf).to.not.be.undefined
      const nested2 = compound.content!.fr.compoundValue!.find((s: any) => s.id === 'nested2')!
      expect(nested2.label).to.equal(contactData.services[1].content.fr.compoundValue![1].label)
      expect(nested2.comment).to.equal(contactData.services[1].content.fr.compoundValue![1].comment)
      expect(Object.keys(nested2.content ?? {})).to.have.length(0)
      expect(nested2.encryptedSelf).to.not.be.undefined
      const nested3 = compound.content!.fr.compoundValue!.find((s: any) => s.id === 'nested3')!
      expect(nested3.label).to.equal(contactData.services[1].content.fr.compoundValue![2].label)
      expect(nested3.comment).to.equal(contactData.services[1].content.fr.compoundValue![2].comment)
      expect(nested3.encryptedSelf).to.be.undefined
      const deeplyNested = nested3.content!.fr.compoundValue!.find((s: any) => s.id === 'deeplyNested')!
      expect(deeplyNested.label).to.equal(contactData.services[1].content.fr.compoundValue![2].content.fr.compoundValue![0].label)
      expect(deeplyNested.comment).to.equal(contactData.services[1].content.fr.compoundValue![2].content.fr.compoundValue![0].comment)
      expect(Object.keys(deeplyNested.content ?? {})).to.have.length(0)
      expect(deeplyNested.encryptedSelf).to.not.be.undefined
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
  })

  it('A HealthElement created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccHelementApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const healthElementData = {
      note: 'secret',
      descr: 'secret2',
      idOpeningContact: 'notSecret',
    }
    const createdV6 = await apiV6.healthcareElementApi.createHealthElementWithUser(
      userV6,
      await apiV6.healthcareElementApi.newInstance(userV6, patient, _.cloneDeep(healthElementData))
    )
    const createdV7 = await apiV7.healthcareElementApi.createHealthElementWithUser(
      userV7,
      await apiV7.healthcareElementApi.newInstance(userV7, patient, _.cloneDeep(healthElementData))
    )
    ;[
      await apiV6.healthcareElementApi.getHealthElementWithUser(userV6, createdV7.id), // Read V7 from V6,
      await apiV7.healthcareElementApi.getHealthElementWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted) => {
      expect(decrypted.idOpeningContact).to.equal(healthElementData.idOpeningContact)
      expect(decrypted.note).to.equal(healthElementData.note)
      expect(decrypted.descr).to.equal(healthElementData.descr)
    })
    const encryptedV6 = await baseApi.getHealthElement(createdV6.id)
    const encryptedV7 = await baseApi.getHealthElement(createdV7.id)
    ;[encryptedV6, encryptedV7].forEach((encrypted) => {
      expect(encrypted.idOpeningContact).to.equal(healthElementData.idOpeningContact)
      expect(encrypted.note).to.be.undefined
      expect(encrypted.descr).to.be.undefined
      expect(encrypted.encryptedSelf).to.not.be.undefined
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
  })

  it('A MaintenanceTask created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccMaintenanceTaskApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const maintenanceTaskData = {
      taskType: 'notSecret',
      properties: [
        { id: 'test1', typedValue: { type: 'string', value: 'secret1' } },
        { id: 'test2', typedValue: { type: 'string', value: 'secret2' } },
      ],
    }
    const createdV6 = await apiV6.maintenanceTaskApi.createMaintenanceTaskWithUser(
      userV6,
      await apiV6.maintenanceTaskApi.newInstance(userV6, _.cloneDeep(maintenanceTaskData))
    )
    const createdV7 = await apiV7.maintenanceTaskApi.createMaintenanceTaskWithUser(
      userV7,
      await apiV7.maintenanceTaskApi.newInstance(userV7, _.cloneDeep(maintenanceTaskData))
    )
    ;[
      await apiV6.maintenanceTaskApi.getMaintenanceTaskWithUser(userV6, createdV7!.id!), // Read V7 from V6,
      await apiV7.maintenanceTaskApi.getMaintenanceTaskWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted) => {
      expect(decrypted.taskType).to.equal(maintenanceTaskData.taskType)
      ;['test1', 'test2'].forEach((propId) => {
        const prop = decrypted.properties!.find((p: any) => p.id === propId)
        const ogProp = maintenanceTaskData.properties!.find((p) => p.id === propId)
        expect(prop).to.not.be.undefined
        expect(prop!.typedValue).to.deep.equal(ogProp!.typedValue)
      })
    })
    const encryptedV6 = await baseApi.getMaintenanceTask(createdV6.id)
    const encryptedV7 = await baseApi.getMaintenanceTask(createdV7!.id!)
    ;[encryptedV6, encryptedV7].forEach((encrypted) => {
      expect(encrypted.taskType).to.equal(maintenanceTaskData.taskType)
      expect(encrypted.properties ?? []).to.have.length(0)
      expect(encrypted.encryptedSelf).to.not.be.undefined
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
  })

  it('A Patient created from V6 should be readable from v7 and vice versa, and the structure of their encrypted data should be equivalent.', async () => {
    const baseApi = new IccPatientApi(env.iCureUrl, {}, apiV7.authApi.authenticationProvider, fetch)
    const patientData = {
      firstName: 'John',
      lastName: 'Doe',
      note: 'This is a note',
      properties: [
        { id: 'test1', typedValue: { type: 'string', value: 'test1' } },
        { id: 'test2', typedValue: { type: 'string', value: 'test2' } },
      ],
    }
    const createdV6 = await apiV6.patientApi.createPatientWithUser(userV6, await apiV6.patientApi.newInstance(userV6, _.cloneDeep(patientData)))
    const createdV7 = await apiV7.patientApi.createPatientWithUser(userV7, await apiV7.patientApi.newInstance(userV7, _.cloneDeep(patientData)))
    ;[
      await apiV6.patientApi.getPatientWithUser(userV6, createdV7.id), // Read V7 from V6,
      await apiV7.patientApi.getPatientWithUser(userV7, createdV6.id), // Read V6 from V7
    ].forEach((decrypted) => {
      expect(decrypted.firstName).to.equal(patientData.firstName)
      expect(decrypted.lastName).to.equal(patientData.lastName)
      expect(decrypted.note).to.equal(patientData.note)
      expect(decrypted.properties ?? []).to.have.length(2)
      ;['test1', 'test2'].forEach((propId) => {
        const prop = decrypted.properties!.find((p: any) => p.id === propId)
        const ogProp = patientData.properties!.find((p) => p.id === propId)
        expect(prop).to.not.be.undefined
        expect(prop!.typedValue).to.deep.equal(ogProp!.typedValue)
      })
    })
    const encryptedV6 = await baseApi.getPatient(createdV6.id)
    const encryptedV7 = await baseApi.getPatient(createdV7.id)
    ;[encryptedV6, encryptedV7].forEach((encrypted) => {
      expect(encrypted.firstName).to.equal(patientData.firstName)
      expect(encrypted.lastName).to.equal(patientData.lastName)
      expect(encrypted.note).to.be.undefined
      expect(encrypted.encryptedSelf).to.not.be.undefined
      expect(encrypted.properties ?? []).to.have.length(2)
      ;['test1', 'test2'].forEach((propId) => {
        const prop = encrypted.properties!.find((p) => p.id === propId)
        expect(prop).to.not.be.undefined
        expect(prop!.typedValue).to.be.undefined
        expect(prop!.encryptedSelf).to.not.be.undefined
      })
    })
    expect(encryptedV6.encryptedSelf!.length).to.equal(encryptedV7.encryptedSelf!.length)
    ;['test1', 'test2'].forEach((propId) => {
      expect(encryptedV6.properties!.find((p) => p.id === propId)!.encryptedSelf!.length).to.equal(
        encryptedV7.properties!.find((p) => p.id === propId)!.encryptedSelf!.length
      )
    })
  })
})
