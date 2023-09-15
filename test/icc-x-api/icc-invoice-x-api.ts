import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { IccPatientXApi, IccUserXApi } from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IccInvoiceApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { Invoice } from '../../icc-api/model/Invoice'
import { assert, expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import initApi = TestUtils.initApi

setLocalStorage(fetch)
let env: TestVars

describe('icc-calendar-item-x-api Tests', () => {
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

  it('Test', async () => {
    // Given
    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)

    const userApi = new IccUserXApi(env.iCureUrl, {}, authProvider, null as any, fetch)
    const invoiceApi = new IccInvoiceApi(env.iCureUrl, {}, authProvider, fetch)

    const currentUser = await userApi.getCurrentUser()
  })

  it('Test findBy not usingPost', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
      entityReferenceApi: entityReferenceApiForHcp,
      invoiceApi: invoiceXApi,
    } = await initApi(env, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    const invoice = new Invoice({
      id: randomUUID(),
      created: new Date().getTime(),
      modified: new Date().getTime(),
      date: +new Date(),
      responsible: hcpUser.healthcarePartyId!,
      author: hcpUser.id,
      codes: [],
      tags: [],
      user: hcpUser.id,
      patient: patient.id,
    })

    const invoiceToCreate = await invoiceXApi.newInstance(hcpUser, patient, invoice)
    const createdInvoice = await invoiceXApi.createInvoice(invoiceToCreate)

    const foundItems = await invoiceXApi.findBy(hcpUser.healthcarePartyId!, patient, false)
    const foundItemsUsingPost = await invoiceXApi.findBy(hcpUser.healthcarePartyId!, patient, true)

    assert(foundItems.length == 1, 'Found items should be 1')
    assert(foundItems[0].id == createdInvoice.id, 'Found item should be the created invoice')

    assert(foundItemsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundItemsUsingPost[0].id == createdInvoice.id, 'Found item using post should be the created invoice')
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
    const entity = await api1.invoiceApi.createInvoice(await api1.invoiceApi.newInstance(user1, samplePatient))
    await api2.invoiceApi
      .getInvoice(entity.id!)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.invoiceApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.invoiceApi.getInvoice(entity.id!)
    expect((await api2.invoiceApi.decryptPatientIdOf(retrieved))[0]).to.equal(samplePatient.id)
  })
})
