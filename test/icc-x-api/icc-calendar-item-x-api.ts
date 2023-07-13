import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { IccCalendarItemXApi, IccPatientXApi, IccUserXApi } from '../../icc-x-api'
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
    } = await initApi(env!, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)
    const calendarItemXApi = new IccCalendarItemXApi(env.iCureUrl, {}, cryptoApiForHcp, dateOwnerApiForHcp, undefined, authProvider, fetch)
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

  it('Should be able to link a calendar item with an existing patient', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const patient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(
        user1,
        {
          firstName: 'Gigio',
          lastName: 'Bagigio',
        },
        { additionalDelegates: { [user2.healthcarePartyId!]: 'WRITE' } }
      )
    )
    const patientSecretIds = await api2.patientApi.decryptNonConfidentialSecretIdsOf(patient)
    expect(patientSecretIds).to.have.length(1)
    const itemTitle = 'An interesting title'
    const calendarItem = await api2.calendarItemApi.createCalendarItemWithHcParty(
      user2,
      await api2.calendarItemApi.newInstance(user2, { title: itemTitle }, { additionalDelegates: { [user1.healthcarePartyId!]: 'WRITE' } })
    )
    expect(calendarItem.title).to.equal(itemTitle)
    expect((await api1.calendarItemApi.getCalendarItemWithUser(user1, calendarItem.id)).title).to.equal(itemTitle)
    expect(await api1.calendarItemApi.decryptPatientIdOf(calendarItem)).to.have.length(0)
    expect(calendarItem.secretForeignKeys ?? []).to.have.length(0)
    const linked = await api1.calendarItemApi.linkToPatient(calendarItem, patient, [user2.healthcarePartyId!])
    expect(linked.title).to.equal(itemTitle)
    expect(linked.secretForeignKeys ?? []).to.have.length(1)
    expect(linked.secretForeignKeys![0]).to.equal(patientSecretIds[0])
    const decryptedPatientIdBy1 = await api1.calendarItemApi.decryptPatientIdOf(linked)
    expect(decryptedPatientIdBy1).to.have.length(1)
    expect(decryptedPatientIdBy1[0]).to.equal(patient.id)
    const retrievedBy2AfterLink = await api2.calendarItemApi.getCalendarItemWithUser(user2, calendarItem.id)
    expect(retrievedBy2AfterLink.title).to.equal(itemTitle)
    const decryptedPatientIdBy2 = await api2.calendarItemApi.decryptPatientIdOf(retrievedBy2AfterLink)
    expect(decryptedPatientIdBy2).to.have.length(1)
    expect(decryptedPatientIdBy2[0]).to.equal(patient.id)
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

  it('newInstance should honor non-default values unless they are undefined', async () => {
    const apis = await initApi(env!, hcp1Username)
    const user = await apis.userApi.getCurrentUser()
    const calendarItemUndefinedId = await apis.calendarItemApi.newInstance(user, { id: undefined })
    expect(calendarItemUndefinedId.id).to.not.be.undefined
    const customId = 'customId'
    const calendarItemCustomId = await apis.calendarItemApi.newInstance(user, { id: customId })
    expect(calendarItemCustomId.id).to.equal(customId)
    const calendarItemUndefinedInit = await apis.calendarItemApi.newInstance(user, undefined as any)
    expect(calendarItemUndefinedInit.id).to.not.be.undefined
  })
})
