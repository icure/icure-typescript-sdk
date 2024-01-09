import {before} from 'mocha'

import 'isomorphic-fetch'

import {IccContactXApi, IccHelementXApi, IccPatientXApi} from '../../icc-x-api'
import {Patient} from '../../icc-api/model/Patient'
import {assert, expect} from 'chai'
import {randomUUID} from 'crypto'
import {getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils} from '../utils/test_utils'
import {Code} from '../../icc-api/model/Code'
import {Contact} from '../../icc-api/model/Contact'
import {Service} from '../../icc-api/model/Service'
import {Content} from '../../icc-api/model/Content'
import {User} from '../../icc-api/model/User'
import {HealthElement} from '../../icc-api/model/HealthElement'
import {SubContact} from '../../icc-api/model/SubContact'
import {ServiceLink} from '../../icc-api/model/ServiceLink'
import {FilterChainService} from '../../icc-api/model/FilterChainService'
import {ServiceByHcPartyHealthElementIdsFilter} from '../../icc-x-api/filters/ServiceByHcPartyHealthElementIdsFilter'
import {getEnvVariables, TestVars} from '@icure/test-setup/types'
import {Measure} from "../../icc-api/model/Measure"
import initApi = TestUtils.initApi

setLocalStorage(fetch)
let env: TestVars

before(async function () {
  this.timeout(600000)
  const initializer = await getEnvironmentInitializer()
  env = await initializer.execute(getEnvVariables())
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

async function createHealthElement(healthElementApi: IccHelementXApi, hcpUser: User, patient: Patient) {
  return healthElementApi.createHealthElementWithUser(
    hcpUser,
    await healthElementApi.newInstance(
      hcpUser,
      patient,
      new HealthElement({
        id: randomUUID(),
        note: 'My secret note',
        tags: [
          new Code({
            id: 'ICURE|MY-CODE|1',
            code: 'MY-CODE',
            type: 'ICURE',
            version: '1',
          }),
        ],
      }),
      {confidential: true}
    )
  )
}

function createBasicContact(contactApiForHcp: IccContactXApi, hcpUser: User, patient: Patient) {
  return contactApiForHcp.newInstance(
    hcpUser,
    patient,
    new Contact({
      id: randomUUID(),
      services: [
        contactApiForHcp.service().newInstance(
          hcpUser,
          new Service({
            id: randomUUID(),
            valueDate: 20220203111034,
            content: {en: new Content({numberValue: 53.5})},
            tags: [
              new Code({
                id: 'LOINC|29463-7|2',
                code: '29463-7',
                type: 'LOINC',
                version: '2',
              }),
            ],
          })
        ),
      ],
      descr: 'Weight value',
    }),
    {confidential: true}
  )
}

describe('icc-x-contact-api Tests', () => {
  it('CreateContactWithUser Success for HCP', async () => {
    // Given
    const {userApi: userApiForHcp, patientApi: patientApiForHcp, contactApi: contactApiForHcp, cryptoApi} = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient)

    // When
    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact

    // Then
    const readContact = await contactApiForHcp.getContactWithUser(hcpUser, createdContact.id!)
    expect(readContact).to.not.be.undefined
    expect(readContact).to.not.be.null
    expect(readContact.openingDate).to.not.be.undefined
    expect(readContact.openingDate).to.not.be.null
    expect(readContact.groupId).to.not.be.undefined
    expect(readContact.groupId).to.not.be.null
    expect(readContact.responsible).to.be.equal(hcpUser.healthcarePartyId)
    expect(readContact.id).to.be.equal(contactToCreate.id)
    expect(readContact.descr).to.be.equal(contactToCreate.descr)
    expect(readContact.services![0].responsible).to.be.equal(hcpUser.healthcarePartyId)
    expect(readContact.services![0].id).to.be.equal(contactToCreate.services![0].id)
    expect(readContact.services![0].valueDate).to.be.equal(contactToCreate.services![0].valueDate)
    expect(readContact.services![0].tags![0].id).to.be.equal(contactToCreate.services![0].tags![0].id!)
    expect(await cryptoApi.xapi.encryptionKeysOf({entity: readContact, type: 'Contact'}, undefined)).to.have.length(1)
    const decryptedPatientIds = await contactApiForHcp.decryptPatientIdOf(readContact)
    expect(decryptedPatientIds).to.have.length(1)
    expect(decryptedPatientIds[0]).to.equal(patient.id)
  })

  it('Filter Services By HealthElementId - Success', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      patientApi: patientApiForHcp,
      contactApi: contactApiForHcp,
      healthcareElementApi: hElementApiForHcp,
    } = await initApi(env!, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const healthElement = await createHealthElement(hElementApiForHcp, hcpUser, patient)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient).then((contact) => {
      return {
        ...contact,
        subContacts: [
          new SubContact({
            id: randomUUID(),
            healthElementId: healthElement!.id!,
            services: [new ServiceLink({serviceId: contact.services![0].id})],
          }),
        ],
      }
    })

    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, new Contact(contactToCreate))) as Contact
    assert(createdContact != null)

    // When
    const foundServices = await contactApiForHcp.filterServicesBy(
      undefined,
      undefined,
      new FilterChainService({
        filter: new ServiceByHcPartyHealthElementIdsFilter({
          healthcarePartyId: hcpUser.healthcarePartyId!,
          healthElementIds: [healthElement!.id!],
        }),
      })
    )

    // Then
    assert(foundServices.rows!.length == 1)
    assert(foundServices.rows![0].id == createdContact.services![0].id)
    assert(foundServices.rows![0].healthElementsIds!.find((heId) => heId == healthElement!.id!) != undefined)
  })

  it('contacts findBy for HCP GET and POSt', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      contactApi: contactApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await initApi(env, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient
    const healthElement = await createHealthElement(hElementApiForHcp, hcpUser, patient)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient).then((contact) => {
      return {
        ...contact,
        subContacts: [
          new SubContact({
            id: randomUUID(),
            healthElementId: healthElement!.id!,
            services: [new ServiceLink({serviceId: contact.services![0].id})],
          }),
        ],
      }
    })

    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact

    // When
    const foundContats = await contactApiForHcp.findBy(hcpUser.healthcarePartyId!, patient, false)
    const foundContatsUsingPost = await contactApiForHcp.findBy(hcpUser.healthcarePartyId!, patient, true)

    // Then
    assert(foundContats.length == 1, 'Found items should be 1')
    assert(foundContats[0].id == contactToCreate.id, 'Found item should be the same as the created one')

    assert(foundContatsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundContatsUsingPost[0].id == createdContact.id, 'Found item using post should be the same as the created one')
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const samplePatient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, {firstName: 'Gigio', lastName: 'Bagigio'})
    )
    const encryptedField = 'Something encrypted'
    const entity = await api1.calendarItemApi.createCalendarItemWithHcParty(
      user1,
      await api1.calendarItemApi.newInstancePatient(user1, samplePatient, {details: encryptedField})
    )
    expect(entity.details).to.be.equal(encryptedField)
    await api2.calendarItemApi
      .getCalendarItemWithUser(user2, entity.id)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.calendarItemApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.calendarItemApi.getCalendarItemWithUser(user2, entity.id)
    expect(retrieved.details).to.be.equal(encryptedField)
    expect((await api2.calendarItemApi.decryptPatientIdOf(retrieved))[0]).to.equal(samplePatient.id)
  })

  it('Instanciation of old Measure should be mapped to new Measure with referenceRange', () => {
    const oldMeasure = {
      min: 0,
      max: 10,
    }

    const newMeasure = new Measure({...oldMeasure})

    expect(newMeasure.referenceRange).to.not.be.undefined
    expect(newMeasure.referenceRange).to.not.undefined
    expect(newMeasure.referenceRange).to.have.length(1)
    expect(newMeasure.referenceRange![0].low).to.be.equal(oldMeasure.min)
    expect(newMeasure.referenceRange![0].high).to.be.equal(oldMeasure.max)
  })

  it('Instanciation of Service with old Measure should be mapped to new Measure with referenceRange', () => {
    const serviceJson = {
      id: 'serviceId',
      valueDate: 20220203111034,
      content: {
        en: {
          numberValue: 53.5,
          measureValue: {
            min: 0,
            max: 10,
          }

        }
      },
      tags: [
        {
          id: 'LOINC|29463-7|2',
          code: '29463-7',
          type: 'LOINC',
          version: '2',
        },
      ],
    }

    const service = new Service(JSON.parse(JSON.stringify(serviceJson)))

    expect(service.content?.en?.measureValue).to.not.be.undefined
    expect(service.content?.en?.measureValue?.referenceRange).to.not.be.undefined
    expect(service.content?.en?.measureValue?.referenceRange).to.have.length(1)
    expect(service.content?.en?.measureValue?.referenceRange![0].low).to.be.equal(serviceJson.content.en.measureValue.min)
    expect(service.content?.en?.measureValue?.referenceRange![0].high).to.be.equal(serviceJson.content.en.measureValue.max)
  })

  it('Instanciation of Contact with old Measure should be mapped to new Measure with referenceRange', () => {
    const contactJson = {
      id: 'contactId',
      services: [
        {
          id: 'serviceId',
          valueDate: 20220203111034,
          content: {
            en: {
              numberValue: 53.5,
              measureValue: {
                min: 0,
                max: 10,
              }
            }
          },
          tags: [
            {
              id: 'LOINC|29463-7|2',
              code: '29463-7',
              type: 'LOINC',
              version: '2',
            },
          ],
        },
      ],
      descr: 'Weight value',
    }

    const contact = new Contact(JSON.parse(JSON.stringify(contactJson)))

    expect(contact.services).to.not.be.undefined
    expect(contact.services).to.have.length(1)
    expect(contact.services![0].content?.en?.measureValue).to.not.be.undefined
    expect(contact.services![0].content?.en?.measureValue?.referenceRange).to.not.be.undefined
    expect(contact.services![0].content?.en?.measureValue?.referenceRange).to.have.length(1)
    expect(contact.services![0].content?.en?.measureValue?.referenceRange![0].low).to.be.equal(contactJson.services[0].content.en.measureValue.min)
    expect(contact.services![0].content?.en?.measureValue?.referenceRange![0].high).to.be.equal(contactJson.services[0].content.en.measureValue.max)
  })


})
