import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, TestUtils } from '../../utils/test_utils'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

let env: TestVars | undefined

describe('User', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be capable of creating a token', async () => {
    const { userApi } = await initApi(env!, hcp1Username)
    const currentUser = await userApi.getCurrentUser()
    const token = await userApi.getTokenInGroup(currentUser.groupId!, currentUser.id!, `e2eTestTS-${randomUUID()}`, undefined, 3)
    expect(token.match(/[a-fA-F0-9]+/))
  }).timeout(30000)
})
