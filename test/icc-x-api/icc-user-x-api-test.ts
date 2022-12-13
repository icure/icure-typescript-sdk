import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../utils/test_utils'
import { before } from 'mocha'
import { Api } from '../../icc-x-api'
import { crypto } from '../../node-compat'

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
    const api = await Api(env.iCureUrl, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password, crypto)
    await api.userApi.getCurrentUser()
  })
})
