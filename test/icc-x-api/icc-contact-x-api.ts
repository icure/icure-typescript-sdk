import {before} from 'mocha'

import 'isomorphic-fetch'

import {LocalStorage} from 'node-localstorage'
import * as os from 'os'
import {Api, IccContactXApi, IccHelementXApi, IccPatientXApi} from '../../icc-x-api'
import {crypto} from '../../node-compat'
import {Patient} from '../../icc-api/model/Patient'
import {assert} from 'chai'
import {randomUUID} from 'crypto'
import {TestUtils} from '../utils/test_utils'
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
      true
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
            content: { en: new Content({ numberValue: 53.5 }) },
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
    true
  )
}

describe('icc-x-contact-api Tests', () => {
  it('CreateContactWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      contactApi: contactApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient)

    // When
    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact

    // Then
    const readContact = await contactApiForHcp.getContactWithUser(hcpUser, createdContact.id!)
    assert(readContact != null)
    assert(readContact.openingDate != null)
    assert(readContact.groupId != null)
    assert(readContact.responsible == hcpUser.healthcarePartyId)
    assert(readContact.id == contactToCreate.id)
    assert(readContact.descr == contactToCreate.descr)
    assert(readContact.delegations[hcpUser.healthcarePartyId!].length > 0)
    assert(readContact.encryptionKeys[hcpUser.healthcarePartyId!].length > 0)
    assert(readContact.services[0].responsible == hcpUser.healthcarePartyId)
    assert(readContact.services[0].id == contactToCreate.services![0].id)
    assert(readContact.services[0].valueDate == contactToCreate.services![0].valueDate!)
    assert(readContact.services[0].tags[0].id == contactToCreate.services![0].tags![0].id!)
  })

  it('Filter Services By HealthElementId - Success', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      contactApi: contactApiForHcp,
      healthcareElementApi: hElementApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = await Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = await createPatient(patientApiForHcp, hcpUser)
    const healthElement = await createHealthElement(hElementApiForHcp, hcpUser, patient)
    const contactToCreate = await createBasicContact(contactApiForHcp, hcpUser, patient).then((contact) => {
      return {
        ...contact,
        subContacts: [
          new SubContact({
            id: randomUUID(),
            healthElementId: healthElement!.id!,
            services: [new ServiceLink({ serviceId: contact.services![0].id })],
          }),
        ],
      }
    })

    const createdContact = (await contactApiForHcp.createContactWithUser(hcpUser, contactToCreate)) as Contact
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
})
