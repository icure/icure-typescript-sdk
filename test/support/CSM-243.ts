import { createNewHcpApi, getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { IccMessageXApi, IcureApi } from '../../icc-x-api'
import { randomUUID } from 'crypto'
import { expect, use as chaiUse } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
import * as chaiAsPromised from 'chai-as-promised'
import { User } from '../../icc-api/model/User'
import { Message } from '../../icc-api/model/Message'
import { PaginatedListMessage } from '../../icc-api/model/PaginatedListMessage'
chaiUse(chaiAsPromised)

let env: TestVars

async function createMessage(
  api: IcureApi,
  user: User,
  props: {
    includeToAddress?: string
    includeFromAddress?: string
    includeRandomReceived: boolean
  }
): Promise<Message> {
  const messageBase: Message = {
    subject: `Test message - ${api.cryptoApi.primitives.randomUuid()}`,
    fromAddress: props.includeFromAddress ?? api.cryptoApi.primitives.randomUuid(),
    toAddresses: [api.cryptoApi.primitives.randomUuid(), props.includeToAddress ?? api.cryptoApi.primitives.randomUuid()],
    received: props.includeRandomReceived ? Math.floor(Math.random() * 1000000) : undefined,
  }
  return await api.messageApi.createMessage(await api.messageApi.newInstance(user, messageBase))
}

async function createTestMessages(
  api: IcureApi,
  user: User,
  propsForAccessibleMessages: {
    includeToAddress?: string
    includeFromAddress?: string
    includeRandomReceived: boolean
  },
  propsForInaccessibleMessages: {
    includeToAddress?: string
    includeFromAddress?: string
    includeRandomReceived: boolean
  }
): Promise<Message[]> {
  const expectedMessages: Message[] = []
  for (let i = 0; i < 100; i++) {
    expectedMessages.push(await createMessage(api, user, propsForAccessibleMessages))
    await createMessage(api, user, propsForInaccessibleMessages)
  }
  // Also creates some messages from an unrelated hcp and same from address that should not be retrieved by the test.
  const { api: otherApi, user: otherUser } = await createNewHcpApi(env)
  for (let i = 0; i < 100; i++) {
    await createMessage(otherApi, otherUser, propsForAccessibleMessages)
  }
  return expectedMessages
}

async function getAllPaginatedMessages(listFunction: (nextKey?: string, nextKeyDocId?: string) => Promise<PaginatedListMessage>): Promise<Message[]> {
  let latestRetrieved: PaginatedListMessage | undefined
  let allResults: Message[] = []
  do {
    const nextKey = latestRetrieved?.nextKeyPair?.startKey
    latestRetrieved = await listFunction(nextKey ? JSON.stringify(nextKey) : undefined, latestRetrieved?.nextKeyPair?.startKeyDocId)
    allResults.push(...latestRetrieved.rows!)
  } while (latestRetrieved?.nextKeyPair?.startKey !== undefined)
  console.log(JSON.stringify(allResults.map((m) => m.received)))
  return allResults
}

describe('CSM-243', async function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function doTestWithoutReceived(
    propsForAccessibleMessages: {
      includeToAddress?: string
      includeFromAddress?: string
    },
    listFunction: (
      messageApi: IccMessageXApi,
      nextKey: string | undefined,
      nextKeyDocId: string | undefined,
      limit: number
    ) => Promise<PaginatedListMessage>
  ) {
    const { api, user } = await createNewHcpApi(env)
    const expectedMessages: Message[] = await createTestMessages(
      api,
      user,
      { ...propsForAccessibleMessages, includeRandomReceived: false },
      { includeRandomReceived: false }
    )
    let allResults: Message[] = await getAllPaginatedMessages((nextKey?: string, nextKeyDocId?: string) =>
      listFunction(api.messageApi, nextKey, nextKeyDocId, 30)
    )
    expect(allResults.length).to.equal(expectedMessages.length)
    expect(allResults.map((m) => m.id)).to.have.members(expectedMessages.map((m) => m.id))
  }

  async function doTestWithReceived(
    propsForAccessibleMessages: {
      includeToAddress?: string
      includeFromAddress?: string
    },
    listFunction: (
      messageApi: IccMessageXApi,
      nextKey: string | undefined,
      nextKeyDocId: string | undefined,
      limit: number
    ) => Promise<PaginatedListMessage>
  ) {
    const { api, user } = await createNewHcpApi(env)
    const expectedMessagesWithReceived: Message[] = await createTestMessages(
      api,
      user,
      { ...propsForAccessibleMessages, includeRandomReceived: true },
      { includeRandomReceived: true }
    )
    const messageWithoutReceived = await createMessage(api, user, { ...propsForAccessibleMessages, includeRandomReceived: false })
    let allResults: Message[] = await getAllPaginatedMessages((nextKey?: string, nextKeyDocId?: string) =>
      listFunction(api.messageApi, nextKey, nextKeyDocId, 30)
    )
    expect(allResults.length).to.equal(expectedMessagesWithReceived.length + 1)
    expect(allResults.map((m) => m.id)).to.have.members([...expectedMessagesWithReceived.map((m) => m.id), messageWithoutReceived.id!])
    expect(allResults.map((m) => m.received)).to.deep.equal([
      undefined,
      ...expectedMessagesWithReceived.sort((a, b) => b.received! - a.received!).map((m) => m.received),
    ])
  }
  it('A user should be able to retrieve paginated messages without received date by fromAddress', async function () {
    const targetAddress = randomUUID()
    await doTestWithoutReceived({ includeFromAddress: targetAddress }, (messageApi, nextKey, nextKeyDocId, limit) =>
      messageApi.findMessagesByFromAddress(targetAddress, nextKey, nextKeyDocId, limit)
    )
  })

  it('A user should be able to retrieve paginated messages with received date by fromAddress', async function () {
    const targetAddress = randomUUID()
    await doTestWithReceived({ includeFromAddress: targetAddress }, (messageApi, nextKey, nextKeyDocId, limit) =>
      messageApi.findMessagesByFromAddress(targetAddress, nextKey, nextKeyDocId, limit)
    )
  })

  it('A user should be able to retrieve paginated messages without received date by toAddress', async function () {
    const targetAddress = randomUUID()
    await doTestWithoutReceived({ includeToAddress: targetAddress }, (messageApi, nextKey, nextKeyDocId, limit) =>
      messageApi.findMessagesByToAddress(targetAddress, nextKey, nextKeyDocId, limit)
    )
  })

  it('A user should be able to retrieve paginated messages with received date by toAddress', async function () {
    const targetAddress = randomUUID()
    await doTestWithReceived({ includeToAddress: targetAddress }, (messageApi, nextKey, nextKeyDocId, limit) =>
      messageApi.findMessagesByToAddress(targetAddress, nextKey, nextKeyDocId, limit)
    )
  })
})
