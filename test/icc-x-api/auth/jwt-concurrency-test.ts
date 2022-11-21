import 'isomorphic-fetch'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../../utils/test_utils'
import { Api, IccUserXApi } from '../../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'
import { XHR } from '../../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { IccAuthApi } from '../../../icc-api'
import { JwtAuthenticationProvider } from '../../../icc-x-api/auth/AuthenticationProvider'

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

  it('It can refresh the token asynchronously', async () => {
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
})
