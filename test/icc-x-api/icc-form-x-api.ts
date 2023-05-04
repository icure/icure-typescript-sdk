import 'isomorphic-fetch'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import { before } from 'mocha'
import { Api, IccFormXApi, IccPatientXApi, IccUserXApi } from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IccFormApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { crypto } from '../../node-compat'
import { Form } from '../../icc-api/model/Form'
import { assert } from 'chai'
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

    const userApi = new IccUserXApi(env.iCureUrl, {}, authProvider, fetch)
    const formApi = new IccFormApi(env.iCureUrl, {}, authProvider, fetch)

    const currentUser = await userApi.getCurrentUser()
  })

  it('Test findBy', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
    } = await initApi(env!, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)
    const formXApi = new IccFormXApi(env.iCureUrl, {}, cryptoApiForHcp, dateOwnerApiForHcp, authProvider, fetch)
    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    const form = new Form({
      id: randomUUID(),
      created: new Date().getTime(),
      modified: new Date().getTime(),
      responsible: hcpUser.healthcarePartyId!,
      author: hcpUser.id,
      codes: [],
      tags: [],
      user: hcpUser.id,
      patient: patient.id,
    })
    const formToCreate = await formXApi.newInstance(hcpUser, patient, form)
    const createdForm = await formXApi.createForm(formToCreate)

    const foundItems: Form[] = (await formXApi.findBy(hcpUser.healthcarePartyId!, patient, false)) as Form[]
    const foundItemsUsingPost: Form[] = (await formXApi.findBy(hcpUser.healthcarePartyId!, patient, true)) as Form[]

    assert(foundItems.length == 1, 'Found items should be 1')
    assert(foundItems[0].id == createdForm.id, 'Found item should be the created one')

    assert(foundItemsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundItemsUsingPost[0].id == createdForm.id, 'Found item using post should be the created one')
  })
})
