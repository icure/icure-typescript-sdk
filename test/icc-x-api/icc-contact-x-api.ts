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
import { Code } from '../../icc-api/model/Code'
import { Contact } from '../../icc-api/model/Contact'
import { Service } from '../../icc-api/model/Service'
import { Content } from '../../icc-api/model/Content'

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

describe('icc-x-contact-api Tests', () => {
  it('CreateContactWithUser Success for HCP', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      patientApi: patientApiForHcp,
      contactApi: contactApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = Api(iCureUrl, hcpUserName!, hcpPassword!, crypto)

    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(userApiForHcp, cryptoApiForHcp, hcpUser, hcpPrivKey!)

    const patient = await patientApiForHcp.createPatientWithUser(
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

    const contactToCreate = await contactApiForHcp.newInstance(
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
})
