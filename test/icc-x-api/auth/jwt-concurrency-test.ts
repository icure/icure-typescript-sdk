import 'isomorphic-fetch'
import { before } from 'mocha'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage } from '../../utils/test_utils'
import { TestApi } from '../../utils/TestApi'
import { IccUserXApi } from '../../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import { XHR } from '../../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { IccAuthApi } from '../../../icc-api'
import { NoAuthenticationProvider, BasicAuthenticationProvider, JwtAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

export function sleep(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Jwt authentication concurrency test', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Can login simultaneously with the same user', async () => {
    const api = await TestApi(
      env.iCureUrl,
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as unknown as Crypto
    )
    const users = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await api.userApi.getCurrentUser()
      })
    )
    users.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })
  })

  it('After logging in, can make requests asynchronously', async () => {
    const api = await TestApi(
      env.iCureUrl,
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as unknown as Crypto
    )

    await api.userApi.getCurrentUser()

    const users = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await api.userApi.getCurrentUser()
      })
    )
    users.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })
  })

  it('It can refresh the token asynchronously', async function () {
    if (!process.env.TEST_ENVIRONMENT || process.env.TEST_ENVIRONMENT === 'acceptance') {
      this.skip()
    }
    const api = await TestApi(
      env.iCureUrl,
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as unknown as Crypto
    )
    await api.userApi.getCurrentUser()

    await sleep(20000)

    const users = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await api.userApi.getCurrentUser()
      })
    )
    users.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })
  })

  it('Can instantiate a x-api without provider and get a 401', async () => {
    const xUserApi = new IccUserXApi(env.iCureUrl, {}, new NoAuthenticationProvider(), null as any)
    xUserApi
      .getCurrentUser()
      .then(() => {
        expect(false).to.be.eq(true, 'I should not get here')
      })
      .catch((e: XHRError) => {
        expect(e.statusCode).to.be.eq(401)
      })
  })

  it('Can instantiate a user-x-api with JWT provider and make requests', async () => {
    const authApi = new IccAuthApi(env.iCureUrl, {})
    const provider = new JwtAuthenticationProvider(authApi, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
    const xUserApi = new IccUserXApi(env.iCureUrl, {}, provider, null as any)

    const users = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await xUserApi.getCurrentUser()
      })
    )
    users.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })

    const tokens = await provider.getIcureTokens()
    expect(tokens).to.not.be.undefined
    const tokenOnlyProvider = new JwtAuthenticationProvider(authApi, undefined, undefined, undefined, tokens)
    const xUserApiTokenOnly = new IccUserXApi(env.iCureUrl, {}, tokenOnlyProvider, null as any)

    const usersTokenOnly = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await xUserApiTokenOnly.getCurrentUser()
      })
    )
    usersTokenOnly.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })
  })

  it('Can instantiate a user-x-api with Basic provider and make requests', async () => {
    const a = new BasicAuthenticationProvider(env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
    const xUserApi = new IccUserXApi(env.iCureUrl, {}, a, null as any)

    const currentUser = await xUserApi.getCurrentUser()
    expect(currentUser.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)

    const fetchedUser = await xUserApi.getUser(currentUser.id!)
    expect(fetchedUser.id).to.be.equal(currentUser.id)
  })
})
