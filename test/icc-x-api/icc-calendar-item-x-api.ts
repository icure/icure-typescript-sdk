import 'isomorphic-fetch'
import {getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars} from '../utils/test_utils'
import { before } from 'mocha'
import {Api, IccAccesslogXApi, IccCalendarItemXApi, IccPatientXApi, IccUserXApi} from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import {IccAccesslogApi, IccCalendarItemApi} from '../../icc-api'
import {Patient} from "../../icc-api/model/Patient"
import {User} from "../../icc-api/model/User"
import {randomUUID} from "crypto"
import {crypto} from "../../node-compat"
import initKey = TestUtils.initKey

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
    const calenderItemApi = new IccCalendarItemApi(env.iCureUrl, {}, authProvider, fetch)

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
    } = await Api(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username].user, env!.dataOwnerDetails[hcp1Username].password, crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, env!.dataOwnerDetails[hcp1Username].privateKey)

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)

    const calendarItemXApi = new IccCalendarItemXApi(env.iCureUrl, {}, cryptoApiForHcp, dateOwnerApiForHcp, undefined, authProvider, fetch)

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    await calendarItemXApi.findBy(hcpUser.healthcarePartyId!, patient, false)
  })

  it('Test findBy usingPost', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
    } = await Api(env!.iCureUrl, env!.dataOwnerDetails[hcp1Username].user, env!.dataOwnerDetails[hcp1Username].password, crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()
    await initKey(dataOwnerApiForHcp, cryptoApiForHcp, hcpUser, env!.dataOwnerDetails[hcp1Username].privateKey)

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)


    const calendarItemXApi = new IccCalendarItemXApi(env.iCureUrl, {}, cryptoApiForHcp, dateOwnerApiForHcp, undefined, authProvider, fetch)

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    await calendarItemXApi.findBy(hcpUser.healthcarePartyId!, patient, true)
  })
})
