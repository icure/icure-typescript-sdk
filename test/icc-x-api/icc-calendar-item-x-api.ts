import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { Api, IccCalendarItemXApi, IccPatientXApi, IccUserXApi } from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IccCalendarItemApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { crypto } from '../../node-compat'
import { CalendarItem } from '../../icc-api/model/CalendarItem'
import { assert, expect } from 'chai'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

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

  it('Test findBy', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
      calendarItemApi: calendarItemXApi,
    } = await initApi(env, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()
    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    const calendarItem: CalendarItem = {
      id: randomUUID(),
      created: new Date().getTime(),
      modified: new Date().getTime(),
      startTime: 20230327131313,
      endTime: 20230327141313,
      responsible: hcpUser.healthcarePartyId!,
      author: hcpUser.id,
      codes: [],
      tags: [],
    }
    const calendarItemToCreate: CalendarItem = await calendarItemXApi.newInstancePatient(hcpUser, patient, calendarItem)
    const createdCalendarItem = await calendarItemXApi.createCalendarItemWithHcParty(hcpUser, calendarItemToCreate)

    const foundItems = await calendarItemXApi.findBy(hcpUser.healthcarePartyId!, patient, false)
    const foundItemsUsingPost = await calendarItemXApi.findBy(hcpUser.healthcarePartyId!, patient, true)

    assert(foundItems.length == 1, 'Found items should be 1')
    assert(foundItems[0].id == createdCalendarItem.id, 'Found item should be the same as created item')

    assert(foundItemsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundItemsUsingPost[0].id == createdCalendarItem.id, 'Found item using post should be the same as created item')
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
    const encryptedField = 'Something encrypted'
    const entity = await api1.calendarItemApi.createCalendarItemWithHcParty(
      user1,
      await api1.calendarItemApi.newInstancePatient(user1, samplePatient, { details: encryptedField })
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
})
