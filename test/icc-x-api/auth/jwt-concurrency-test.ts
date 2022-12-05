import 'isomorphic-fetch'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../../utils/test_utils'
import { Api, IccCodeXApi, IccUserXApi } from '../../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import { XHR } from '../../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { IccAuthApi } from '../../../icc-api'
import { BasicAuthenticationProvider, JwtAuthenticationProvider, NoAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'

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
    const api = await Api(
      env.iCureUrl,
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as unknown as Crypto,
      fetch,
      false,
      false
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
    const api = await Api(
      env.iCureUrl,
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password,
      webcrypto as unknown as Crypto,
      fetch,
      false,
      false
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

  it('Can instantiate a x-api without provider and get a 401', async () => {
    const xUserApi = new IccUserXApi(env.iCureUrl, {})
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
    const xUserApi = new IccUserXApi(
      env.iCureUrl,
      {},
      new JwtAuthenticationProvider(authApi, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
    )

    const users = await Promise.all(
      [...Array<number>(5)].map(async () => {
        return await xUserApi.getCurrentUser()
      })
    )
    users.forEach((u) => {
      expect(u.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)
    })
  })

  it('Can instantiate a user-x-api with Basic provider and make requests', async () => {
    const a = new BasicAuthenticationProvider(env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
    const headers = await a.getAuthService().getAuthHeaders()
    const xUserApi = new IccUserXApi(
      env.iCureUrl,
      headers.reduce((prev, h) => {
        return { ...prev, [h.header]: h.data }
      }, {})
    )

    const currentUser = await xUserApi.getCurrentUser()
    expect(currentUser.login).to.be.equal(env.dataOwnerDetails[hcp1Username].user)

    const fetchedUser = await xUserApi.getUser(currentUser.id!)
    expect(fetchedUser.id).to.be.equal(currentUser.id)

    await xUserApi.getToken(currentUser.id!, 'a_random_key')
  })

  it('It can refresh the token after one hour', async () => {
    const authProvider = new JwtAuthenticationProvider(
      new IccAuthApi(env.iCureUrl, {}),
      env.dataOwnerDetails[hcp1Username].user,
      env.dataOwnerDetails[hcp1Username].password
    )
    const userApi = new IccUserXApi(env.iCureUrl, {}, authProvider, fetch)
    const codeApi = new IccCodeXApi(env.iCureUrl, {}, authProvider, fetch)

    console.log('I start')
    await userApi.getCurrentUser()

    console.log('I try to get some codes')
    await codeApi.findCodes('be')

    console.log('I wait')
    await sleep(30 * 1000)

    console.log('I get the current user')
    await userApi.getCurrentUser()

    console.log('I try to get some codes')
    await codeApi.findCodes('be')
  }).timeout(7200 * 1000)
})
