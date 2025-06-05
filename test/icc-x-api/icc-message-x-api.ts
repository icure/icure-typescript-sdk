import 'isomorphic-fetch'
import {
  createNewHcpApi,
  describeNoLite,
  getEnvironmentInitializer,
  hcp1Username,
  hcp2Username,
  hcp3Username,
  setLocalStorage,
  TestUtils,
} from '../utils/test_utils'
import { before, it, describe } from 'mocha'
import { IccMessageXApi, IccPatientXApi, sleep, SubscriptionOptions } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccTopicXApi } from '../../icc-x-api/icc-topic-x-api'
import { Topic, TopicRole } from '../../icc-api/model/Topic'
import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { XHR } from '../../icc-api/api/XHR'
import { Message } from '../../icc-api/model/Message'
import initApi = TestUtils.initApi
import XHRError = XHR.XHRError
import { FilterChainMessage } from '../../icc-api/model/FilterChainMessage'
import { MessageByHcPartyFilter } from '../../icc-x-api/filters/MessageByHcPartyFilter'
import { MessageByHcPartyTransportGuidFilter } from '../../icc-x-api/filters/MessageByHcPartyTransportGuidFilter'
import { LatestMessageByHcPartyTransportGuidFilter } from '../../icc-x-api/filters/LatestMessageByHcPartyTransportGuidFilter'
import { Connection } from '../../icc-api/model/Connection'
import { expect, use as chaiUse } from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { IccMessageApi } from '../../icc-api'
import undefinedError = Mocha.utils.undefinedError
import { create } from 'lodash'

chaiUse(chaiAsPromised)
setLocalStorage(fetch)
let env: TestVars

describe('icc-message-x-api', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Should be encrypted', async () => {
    const hcp = await createNewHcpApi(env, {
      encryptedFieldsConfig: {
        message: ['subject'],
      },
    })
    const subject = 'Hello'
    const transportGuid = randomUUID()
    const created = await hcp.api.messageApi.createMessageWithUser(
      undefined,
      await hcp.api.messageApi.newInstance(hcp.user, {
        id: randomUUID(),
        subject,
        transportGuid,
      })
    )
    expect(created.subject).to.eq(subject)
    expect(created.transportGuid).to.eq(transportGuid)
    const retrieved = await hcp.api.messageApi.getMessageWithUser(undefined, created.id!)
    expect(retrieved.subject).to.eq(subject)
    expect(retrieved.transportGuid).to.eq(transportGuid)
    const encrypted = await new IccMessageApi(env.iCureUrl, {}, hcp.api.authApi.authenticationProvider, fetch).getMessage(created.id!)
    expect(encrypted.subject).to.be.undefined
    expect(encrypted.transportGuid).to.eq(transportGuid)
  })
})
