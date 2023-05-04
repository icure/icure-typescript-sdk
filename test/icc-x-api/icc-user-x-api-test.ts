import { getEnvironmentInitializer, hcp1Username, setLocalStorage } from '../utils/test_utils'
import { before } from 'mocha'
import { crypto } from '../../node-compat'
import { TestApi } from '../utils/TestApi'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

describe('icc-x-user-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Can instantiate an API and get the current user', async () => {
    // Given
    const api = await TestApi(env.iCureUrl, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password, crypto)
    await api.userApi.getCurrentUser()
  })
})
