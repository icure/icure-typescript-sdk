import 'isomorphic-fetch'
import {describeNoLite, getEnvironmentInitializer, hcp1Username, hcp2Username, hcp3Username, setLocalStorage, TestUtils} from '../utils/test_utils'
import {before, it} from 'mocha'
import {IccPatientXApi, IccUserXApi, sleep, SubscriptionOptions} from '../../icc-x-api'
import {IccCalendarItemApi, IccTopicApi} from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { CalendarItem } from '../../icc-api/model/CalendarItem'
import { assert, expect } from 'chai'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { BasicAuthenticationProvider } from '../../icc-x-api'
import {TopicByHcPartyFilter} from "../../icc-x-api/filters/TopicByHcPartyFilter"
import {Connection} from "../../icc-api/model/Connection"
import {CalendarItemByDataOwnerPatientStartTimeFilter} from "../../icc-x-api/filters/CalendarItemByDataOwnerPatientStartTimeFilter"
import {CalendarItemByPeriodAndDataOwnerIdFilter} from "../../icc-x-api/filters/CalendarItemByPeriodAndDataOwnerIdFilter"

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

  it('Should be able to link a calendar item with an existing patient', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const api3 = await initApi(env!, hcp3Username)
    const user3 = await api3.userApi.getCurrentUser()
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
    const linked = await api1.calendarItemApi.linkToPatient(calendarItem, patient, [user2.healthcarePartyId!, user3.healthcarePartyId!])
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
    const retrievedBy3AfterLink = await api3.calendarItemApi.getCalendarItemWithUser(user3, calendarItem.id)
    expect(retrievedBy3AfterLink.title).to.be.undefined // not shared with user3
    const decryptedPatientIdBy3 = await api3.calendarItemApi.decryptPatientIdOf(retrievedBy3AfterLink)
    expect(decryptedPatientIdBy3).to.have.length(1)
    expect(decryptedPatientIdBy3[0]).to.equal(patient.id)
    const sharedInfo = await api1.calendarItemApi.getDataOwnersWithAccessTo(linked)
    expect(sharedInfo.hasUnknownAnonymousDataOwners).to.be.false
    expect(Object.keys(sharedInfo.permissionsByDataOwnerId)).to.have.members([
      user1.healthcarePartyId!,
      user2.healthcarePartyId!,
      user3.healthcarePartyId!,
    ])
    expect(sharedInfo.permissionsByDataOwnerId[user1.healthcarePartyId!]).to.equal(AccessLevelEnum.WRITE)
    expect(sharedInfo.permissionsByDataOwnerId[user2.healthcarePartyId!]).to.equal(AccessLevelEnum.WRITE)
    expect(sharedInfo.permissionsByDataOwnerId[user3.healthcarePartyId!]).to.equal(AccessLevelEnum.READ)
  })
})

describeNoLite('icc-calendarItem-x-api websocket Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function doXOnYAndSubscribe<Y>(
    connectionPromise: Promise<Connection>,
    x: () => Promise<Y>,
    statusListener: (status: string) => void,
    eventReceivedPromiseReject: (reason?: any) => void,
    eventReceivedPromise: Promise<void>
  ) {
    const connection = (await connectionPromise)
      .onClosed(async () => {
        statusListener('CLOSED')
        await sleep(3_000)
      })
      .onConnected(async () => {
        statusListener('CONNECTED')
        await sleep(2_000)
        await x()
      })

    const timeout = setTimeout(eventReceivedPromiseReject, 20_000)
    await eventReceivedPromise.then(() => clearTimeout(timeout)).catch(() => {})

    connection.close()

    await sleep(3_000)
  }

  const subscribeAndCreateCalendarItem = async (options: SubscriptionOptions, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {
    const { userApi: userApiForHcp, calendarItemApi: calendarItemApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    function formatDate(date: Date) : string {
      const pad = (num: number) => (num < 10 ? '0' + num : num.toString())

      const year = date.getFullYear()
      const month = pad(date.getMonth() + 1)
      const day = pad(date.getDate())
      const hours = pad(date.getHours())
      const minutes = pad(date.getMinutes())
      const seconds = pad(date.getSeconds())

      return `${year}${month}${day}${hours}${minutes}${seconds}`
    }

    const currentDate = new Date()
    const datePlusOneHour = new Date(currentDate.getTime() + 60 * 60 * 1000)
    const datePlusTwoHours = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000)
    const datePlusThreeHours = new Date(currentDate.getTime() + 3 * 60 * 60 * 1000)

    const loggedUser = await userApiForHcp.getCurrentUser()
    const connectionPromise = async (options: SubscriptionOptions, eventListener: (calendarItem: CalendarItem) => Promise<void>) =>
      calendarItemApiForHcp.subscribeToCalendarItemEvents(
        eventTypes,
        new CalendarItemByPeriodAndDataOwnerIdFilter({
          dataOwnerId: loggedUser!.healthcarePartyId!,
          startTime: formatDate(currentDate),
          endTime: formatDate(datePlusThreeHours),

        }),
        eventListener,
        options
      )

    const events: CalendarItem[] = []
    const statuses: string[] = []

    let eventReceivedPromiseResolve!: (value: void | PromiseLike<void>) => void
    let eventReceivedPromiseReject!: (reason?: any) => void
    const eventReceivedPromise = new Promise<void>((res, rej) => {
      eventReceivedPromiseResolve = res
      eventReceivedPromiseReject = rej
    })

    await doXOnYAndSubscribe(
      connectionPromise(options, async (healthcareElement) => {
        events.push(healthcareElement)
        eventReceivedPromiseResolve()
      }),
      async () => {

        await calendarItemApiForHcp.createCalendarItemWithHcParty(
          loggedUser,
          await calendarItemApiForHcp.newInstance(
            loggedUser,
            new CalendarItem({
              id: randomUUID(),
              created: new Date().getTime(),
              modified: new Date().getTime(),
              startTime: formatDate(datePlusOneHour),
              endTime: formatDate(datePlusTwoHours),
              responsible: loggedUser.healthcarePartyId!,
              author: loggedUser.id,
              codes: [],
              tags: [],
            })
          )
        )
      },
      (status) => {
        statuses.push(status)
      },
      eventReceivedPromiseReject,
      eventReceivedPromise
    )

    events?.forEach((event) => console.log(`Event : ${event}`))
    statuses?.forEach((status) => console.log(`Status : ${status}`))

    expect(statuses).to.have.length(2)
    expect(events).to.have.length(1)
  }

  it('CREATE CalendarItem without options', async () => {
    await subscribeAndCreateCalendarItem({}, ['CREATE'])
  }).timeout(60000)

  it('CREATE CalendarItem with options', async () => {
    await subscribeAndCreateCalendarItem(
      {
        connectionRetryIntervalMs: 10_000,
        connectionMaxRetry: 5,
      },
      ['CREATE']
    )
  }).timeout(60000)
})

