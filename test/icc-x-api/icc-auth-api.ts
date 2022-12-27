import 'isomorphic-fetch'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../utils/test_utils'
import { before } from 'mocha'
import { BasicAuthenticationProvider, EnsembleAuthenticationProvider, NoAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { Api } from '../../icc-x-api'
import { IccAuthApi } from '../../icc-api'
import { crypto } from '../../node-compat'
import { TestApi } from '../utils/TestApi'

setLocalStorage(fetch)
let env: TestVars

describe('icc-auth-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Can login and then logout instating all the Apis', async () => {
    // Given
    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const { authApi } = await TestApi(env!.iCureUrl, username, password, crypto)

    await authApi.logout()
  })

  it('Can login and then logout instating only the AuthApi', async () => {
    // Given
    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authenticationProvider = new EnsembleAuthenticationProvider(
      new IccAuthApi(env.iCureUrl, {}, new NoAuthenticationProvider(), fetch),
      username,
      password
    )

    const authApi = new IccAuthApi(env.iCureUrl, {}, authenticationProvider, fetch)

    await authApi.logout()
  })
})
