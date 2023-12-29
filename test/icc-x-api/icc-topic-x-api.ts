import 'isomorphic-fetch'
import { describeNoLite, getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before, it, describe } from 'mocha'
import { IccPatientXApi, sleep, SubscriptionOptions } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccTopicXApi } from '../../icc-x-api/icc-topic-x-api'
import { Topic, TopicRole } from '../../icc-api/model/Topic'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import initApi = TestUtils.initApi
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { FilterChainTopic } from '../../icc-api/model/FilterChainTopic'
import { TopicByHcPartyFilter } from '../../icc-x-api/filters/TopicByHcPartyFilter'
import { TopicByParticipantFilter } from '../../icc-x-api/filters/TopicByParticipantFilter'
import { Connection } from '../../icc-api/model/Connection'
import { Message } from '../../icc-api/model/Message'
import { IccTopicApi } from '../../icc-api'

setLocalStorage(fetch)
let env: TestVars

describeNoLite('icc-topic-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function createTopic(topicApi: IccTopicXApi, hcpUser: User, patient: Patient, ...additionalUser: { user: User; role: TopicRole }[]) {
    return topicApi.createTopic(
      await topicApi.newInstance(
        hcpUser,
        patient,
        new Topic({
          id: randomUUID(),
          description: 'Topic description',
          activeParticipants: {
            ...Object.fromEntries(additionalUser.map((u) => [u.user.healthcarePartyId!, u.role])),
            [hcpUser.healthcarePartyId!]: TopicRole.OWNER,
          },
        }),
        {
          additionalDelegates: Object.fromEntries(additionalUser.map((u) => [u.user.healthcarePartyId!, SecureDelegation.AccessLevelEnum.WRITE])),
        }
      )
    )
  }

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

  it('An HCP should be able to create a topic with participants', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)
  }).timeout(10_000)

  it('An HCP should be able to create an encrypted topic', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const baseTopicApi = new IccTopicApi(env!.iCureUrl, topicApiForHcp._headers, topicApiForHcp.authenticationProvider, topicApiForHcp.fetchImpl)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient)

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)
    expect(retrievedByHcp.description).to.not.be.undefined

    const notDecryptedTopic = await baseTopicApi.getTopic(createdTopic.id!)
    expect(notDecryptedTopic).to.not.deep.equal(createdTopic)
    expect(notDecryptedTopic.description).to.be.undefined
    expect(notDecryptedTopic.encryptedSelf).to.not.be.undefined
  }).timeout(10_000)

  it('An HCP should be able to create a topic with no participants and add participants later', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient)

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    try {
      await topicApiForHcp2.getTopic(createdTopic.id!)
      expect.fail('Should not be able to get topic')
    } catch (e) {
      expect((e as XHRError).statusCode).to.equal(403)
    }

    await topicApiForHcp.addParticipantWithTopic({ dataOwnerId: hcpUser2.healthcarePartyId!, topicRole: TopicRole.PARTICIPANT }, createdTopic)

    const retrievedByHcpAfterAddParticipant = await topicApiForHcp.getTopic(createdTopic.id!)
    const retrievedByHcp2AfterAddParticipant = await topicApiForHcp2.getTopic(createdTopic.id!)

    expect(retrievedByHcp2AfterAddParticipant).to.deep.equal(retrievedByHcpAfterAddParticipant)
    expect(retrievedByHcpAfterAddParticipant.id).to.equal(createdTopic.id)
    expect(retrievedByHcp2AfterAddParticipant.activeParticipants).all.keys(hcpUser.healthcarePartyId!, hcpUser2.healthcarePartyId!)
    expect(retrievedByHcp2AfterAddParticipant.activeParticipants![hcpUser2.healthcarePartyId!]).to.equal(TopicRole.PARTICIPANT)
    expect(retrievedByHcp2AfterAddParticipant.activeParticipants![hcpUser.healthcarePartyId!]).to.equal(TopicRole.OWNER)
  }).timeout(10_000)

  it('A participant should not be able to remove another participant', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)

    try {
      await topicApiForHcp2.removeParticipant({ dataOwnerId: hcpUser.healthcarePartyId! }, createdTopic.id!)
      expect.fail('Should not be able to remove participant')
    } catch (e) {
      expect((e as XHRError).statusCode).to.equal(403)
    }
  }).timeout(10_000)

  it('A participant should be able to remove himself but still able to get topic', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)

    await topicApiForHcp2.removeParticipant({ dataOwnerId: hcpUser2.healthcarePartyId! }, createdTopic.id!)

    const retrievedByHcpAfterRemoveParticipant = await topicApiForHcp.getTopic(createdTopic.id!)
    const retrievedByHcp2AfterRemoveParticipant = await topicApiForHcp2.getTopic(createdTopic.id!)

    expect(retrievedByHcpAfterRemoveParticipant).to.deep.equal(retrievedByHcp2AfterRemoveParticipant)
  }).timeout(10_000)

  it('An owner should be able to remove a participant', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)

    const topicWithRemovedParticipant = await topicApiForHcp.removeParticipant({ dataOwnerId: hcpUser2.healthcarePartyId! }, createdTopic.id!)
    expect(topicWithRemovedParticipant.activeParticipants).all.keys(hcpUser.healthcarePartyId!)

    const retrievedByHcp2AfterRemoveParticipant = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2AfterRemoveParticipant).to.deep.equal(topicWithRemovedParticipant)
  }).timeout(10_000)

  it('A participant should be able to filter topics using TopicByHcPartyFilter', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)

    const filterChain = (hcpId: string) =>
      new FilterChainTopic({
        filter: new TopicByHcPartyFilter({
          hcpId,
        }),
      })

    const filterResultForHcp = await topicApiForHcp.filterTopicsBy(filterChain(hcpUser.healthcarePartyId!))
    expect(filterResultForHcp.rows!.find((v) => v.id === createdTopic.id)).to.deep.equal(createdTopic)

    const filterResultForHcp2 = await topicApiForHcp2.filterTopicsBy(filterChain(hcpUser2.healthcarePartyId!))
    expect(filterResultForHcp2.rows!.find((v) => v.id === createdTopic.id)).to.deep.equal(createdTopic)
  }).timeout(60_000)

  it('A participant should be able to filter topics using TopicByParticipantFilter', async () => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const { userApi: userApiForHcp2, topicApi: topicApiForHcp2 } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, { user: hcpUser2, role: TopicRole.PARTICIPANT })

    const retrievedByHcp = await topicApiForHcp.getTopic(createdTopic.id!)
    expect(retrievedByHcp).to.deep.equal(createdTopic)

    const retrievedByHcp2 = await topicApiForHcp2.getTopic(createdTopic.id!)
    expect(retrievedByHcp2).to.deep.equal(createdTopic)

    const filterChain = (hcpId: string) =>
      new FilterChainTopic({
        filter: new TopicByParticipantFilter({
          participantId: hcpId,
        }),
      })

    const filterResultForHcp = await topicApiForHcp.filterTopicsBy(filterChain(hcpUser.healthcarePartyId!))
    expect(filterResultForHcp.rows?.map((t) => t.id)).to.includes(createdTopic.id)

    const filterResultForHcp2 = await topicApiForHcp2.filterTopicsBy(filterChain(hcpUser2.healthcarePartyId!))
    expect(filterResultForHcp2.rows?.map((t) => t.id)).to.includes(createdTopic.id)
  }).timeout(10_000)

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

  const subscribeAndCreateTopic = async (options: SubscriptionOptions, eventTypes: ('CREATE' | 'DELETE' | 'UPDATE')[]) => {
    const { userApi: userApiForHcp, topicApi: topicApiForHcp, patientApi: patientApiForHcp } = await initApi(env!, hcp1Username)

    const loggedUser = await userApiForHcp.getCurrentUser()
    const connectionPromise = async (options: SubscriptionOptions, eventListener: (healthcareElement: Message) => Promise<void>) =>
      topicApiForHcp.subscribeToTopicEvents(
        eventTypes,
        new TopicByHcPartyFilter({
          hcpId: loggedUser!.healthcarePartyId!,
        }),
        eventListener,
        options
      )

    const events: Message[] = []
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
        const user = await userApiForHcp.getCurrentUser()

        const patient = await patientApiForHcp.createPatientWithUser(
          user,
          await patientApiForHcp.newInstance(
            user,
            new Patient({
              firstName: 'John',
              lastName: 'Snow',
              note: 'Winter is coming',
            })
          )
        )

        const topic = await topicApiForHcp.createTopic(
          await topicApiForHcp.newInstance(
            loggedUser,
            patient,
            new Topic({
              description: 'Topic description',
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
    expect(events.every((event) => event instanceof Topic)).to.be.true
  }

  it('CREATE Topic without options', async () => {
    await subscribeAndCreateTopic({}, ['CREATE'])
  }).timeout(60000)

  it('CREATE Topic with options', async () => {
    await subscribeAndCreateTopic(
      {
        connectionRetryIntervalMs: 10_000,
        connectionMaxRetry: 5,
      },
      ['CREATE']
    )
  }).timeout(60000)
})
