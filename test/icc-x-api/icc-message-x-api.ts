import 'isomorphic-fetch'
import {getEnvironmentInitializer, hcp1Username, hcp2Username, hcp3Username, setLocalStorage, TestUtils} from '../utils/test_utils'
import {before, it} from 'mocha'
import {IccMessageXApi, IccPatientXApi} from '../../icc-x-api'
import {Patient} from '../../icc-api/model/Patient'
import {User} from '../../icc-api/model/User'
import {randomUUID} from 'crypto'
import {getEnvVariables, TestVars} from '@icure/test-setup/types'
import {IccTopicXApi} from "../../icc-x-api/icc-topic-x-api"
import {Topic, TopicRole} from "../../icc-api/model/Topic"
import {SecureDelegation} from "../../icc-api/model/SecureDelegation"
import {XHR} from "../../icc-api/api/XHR"
import {Message} from "../../icc-api/model/Message"
import initApi = TestUtils.initApi
import {expect} from "chai"
import XHRError = XHR.XHRError
import {FilterChainMessage} from "../../icc-api/model/FilterChainMessage"
import {MessageByHcPartyFilter} from "../../icc-x-api/filters/MessageByHcPartyFilter"
import {MessageByHcPartyTransportGuidFilter} from "../../icc-x-api/filters/MessageByHcPartyTransportGuidFilter"
import {LatestMessageByHcPartyTransportGuidFilter} from "../../icc-x-api/filters/LatestMessageByHcPartyTransportGuidFilter"

setLocalStorage(fetch)
let env: TestVars

describe('icc-message-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function createMessage(messageApi: IccMessageXApi, hcpUser: User, patient: Patient, topic: Topic) {
    return messageApi.createEncryptedMessage(
      await messageApi.newInstanceWithPatient(
        hcpUser,
        patient,
        new Message(
          {
            id: randomUUID(),
            subject: 'Message Subject',
            sent: new Date().getTime(),
            transportGuid: topic.id,
            readStatus: Object.fromEntries(Object.keys(topic.activeParticipants ?? {}).filter(p => p != hcpUser.healthcarePartyId).map((hcpId) => [hcpId, {read: false}])),
            fromHealthcarePartyId: hcpUser.healthcarePartyId,
          }
        ),
        {
          additionalDelegates: Object.fromEntries(Object.keys(topic.activeParticipants ?? {}).map((hcpId) => [hcpId, SecureDelegation.AccessLevelEnum.WRITE]))
        }
      )
    )
  }

  async function createTopic(topicApi: IccTopicXApi, hcpUser: User, patient: Patient, ...additionalUser: { user: User, role: TopicRole }[]) {
    return topicApi.createTopic(
      await topicApi.newInstance(
        hcpUser,
        patient,
        new Topic({
          id: randomUUID(),
          description: 'Topic description',
          activeParticipants: {
            ...Object.fromEntries(additionalUser.map(u => [u.user.healthcarePartyId!, u.role])),
            [hcpUser.healthcarePartyId!]: TopicRole.OWNER
          },
        }),
        {
          additionalDelegates: Object.fromEntries(additionalUser.map(u => [u.user.healthcarePartyId!, SecureDelegation.AccessLevelEnum.WRITE]))
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

  it('An HCP should be able to publish a message on a topic and a participant can read it', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)
    const message2 = await messageApiForHcp2.getDecryptedMessage(createdMessage.id!)

    expect(message).to.deep.equal(message2)
  })

  it('An HCP should be able to publish a message on a topic and a non-participant cannot read it', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
    } = await initApi(env!, hcp2Username)

    const {
      messageApi: messageApiForHcp3
    } = await initApi(env!, hcp3Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)
    expect(message).to.not.be.null

    try {
      const message3 = await messageApiForHcp3.getDecryptedMessage(createdMessage.id!)
      console.log(message3)
      expect.fail('Should have thrown an error')
    }
    catch (e) {
      expect(e).to.be.instanceOf(XHR.XHRError)
      expect((e as XHRError).statusCode).to.equal(403)
    }
  })

  it('An HCP should be able to publish a message on a topic and a participant could query it through MessageByHcPartyFilter', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)

    const filterChain = (hcpId: string) => new FilterChainMessage({
      filter: new MessageByHcPartyFilter({
        hcpId: hcpId,
      })
    })

    const filterResultForHcp = await messageApiForHcp.filterMessagesBy(filterChain(hcpUser.healthcarePartyId!))
    expect(filterResultForHcp.rows).to.have.length.greaterThanOrEqual(1)
    expect(filterResultForHcp.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp2 = await messageApiForHcp2.filterMessagesBy(filterChain(hcpUser2.healthcarePartyId!))
    expect(filterResultForHcp2.rows).to.have.length.greaterThanOrEqual(1)
    expect(filterResultForHcp2.rows!.find(m => m.id === message.id)).to.deep.equal(message)
  })

  it('An HCP should be able to publish a message on a topic and a non-participant should not be able to query it through MessageByHcPartyFilter', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const {
      messageApi: messageApiForHcp3,
      userApi: userApiForHcp3,
    } = await initApi(env!, hcp3Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()
    const hcpUser3 = await userApiForHcp3.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)

    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)

    const filterChain = (hcpId: string) => new FilterChainMessage({
      filter: new MessageByHcPartyFilter({
        hcpId: hcpId,
      })
    })

    const filterResultForHcp = await messageApiForHcp.filterMessagesBy(filterChain(hcpUser.healthcarePartyId!))
    expect(filterResultForHcp.rows).to.have.length.greaterThanOrEqual(1)
    expect(filterResultForHcp.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp2 = await messageApiForHcp2.filterMessagesBy(filterChain(hcpUser2.healthcarePartyId!))
    expect(filterResultForHcp2.rows).to.have.length.greaterThanOrEqual(1)
    expect(filterResultForHcp2.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp3 = await messageApiForHcp3.filterMessagesBy(filterChain(hcpUser3.healthcarePartyId!))
    expect(filterResultForHcp3.rows!.find(m => m.id === message.id)).to.be.undefined
  })

  it('An HCP should be able to publish a message on a topic and a participant could query it through MessageByHcPartyTransportGuidFilter', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)

    const filterChain = (hcpId: string, transportGuid: string) => new FilterChainMessage({
      filter: new MessageByHcPartyTransportGuidFilter({
        healthcarePartyId: hcpId,
        transportGuid: transportGuid,
      })
    })

    const filterResultForHcp = await messageApiForHcp.filterMessagesBy(filterChain(hcpUser.healthcarePartyId!, message.transportGuid!))
    expect(filterResultForHcp.rows).to.have.length(1)
    expect(filterResultForHcp.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp2 = await messageApiForHcp2.filterMessagesBy(filterChain(hcpUser2.healthcarePartyId!, message.transportGuid!))
    expect(filterResultForHcp2.rows).to.have.length(1)
    expect(filterResultForHcp2.rows!.find(m => m.id === message.id)).to.deep.equal(message)
  })

  it('An HCP should be able to publish a message on a topic and a non-participant should not be able to query it through MessageByHcPartyTransportGuidFilter', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const {
      userApi: userApiForHcp3,
      messageApi: messageApiForHcp3
    } = await initApi(env!, hcp3Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()
    const hcpUser3 = await userApiForHcp3.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    const createdMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)

    const message = await messageApiForHcp.getDecryptedMessage(createdMessage.id!)

    const filterChain = (hcpId: string, transportGuid: string) => new FilterChainMessage({
      filter: new MessageByHcPartyTransportGuidFilter({
        healthcarePartyId: hcpId,
        transportGuid: transportGuid,
      })
    })

    const filterResultForHcp = await messageApiForHcp.filterMessagesBy(filterChain(hcpUser.healthcarePartyId!, message.transportGuid!))
    expect(filterResultForHcp.rows).to.have.length(1)
    expect(filterResultForHcp.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp2 = await messageApiForHcp2.filterMessagesBy(filterChain(hcpUser2.healthcarePartyId!, message.transportGuid!))
    expect(filterResultForHcp2.rows).to.have.length(1)
    expect(filterResultForHcp2.rows!.find(m => m.id === message.id)).to.deep.equal(message)

    const filterResultForHcp3 = await messageApiForHcp3.filterMessagesBy(filterChain(hcpUser3.healthcarePartyId!, message.transportGuid!))
    expect(filterResultForHcp3.rows!.find(m => m.id === message.id)).to.be.undefined
  })

  it('An HCP should be able to publish a message on a topic and a participant should be able to query it through LatestMessageByHcPartyTransportGuidFilter', async () => {
    const {
      userApi: userApiForHcp,
      topicApi: topicApiForHcp,
      patientApi: patientApiForHcp,
      messageApi: messageApiForHcp
    } = await initApi(env!, hcp1Username)

    const {
      userApi: userApiForHcp2,
      messageApi: messageApiForHcp2
    } = await initApi(env!, hcp2Username)

    const hcpUser = await userApiForHcp.getCurrentUser()
    const hcpUser2 = await userApiForHcp2.getCurrentUser()

    const samplePatient = await createPatient(patientApiForHcp, hcpUser)
    const createdTopic = await createTopic(topicApiForHcp, hcpUser, samplePatient, {user: hcpUser2, role: TopicRole.PARTICIPANT})

    let latestMessage: Message | null = null;
    for (let i = 0; i < 5; i++) { // Creating 5 messages
      latestMessage = await createMessage(messageApiForHcp, hcpUser, samplePatient, createdTopic)
    }

    const filterChain = (hcpId: string, transportGuid: string) => new FilterChainMessage({
      filter: new LatestMessageByHcPartyTransportGuidFilter({
        healthcarePartyId: hcpId,
        transportGuid: transportGuid,
      })
    })

    const filterResultForHcp2 = await messageApiForHcp2.filterMessagesBy(filterChain(hcpUser2.healthcarePartyId!, latestMessage!.transportGuid!))
    expect(filterResultForHcp2.rows).to.have.length(1) // Only one message should be returned
    expect(filterResultForHcp2.rows![0]).to.deep.equal(latestMessage) // It should be the latest message
  })
})
