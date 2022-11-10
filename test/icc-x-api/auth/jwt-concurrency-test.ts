import 'isomorphic-fetch'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestVars } from '../../utils/test_utils'
import { Api } from '../../../icc-x-api'
import { webcrypto } from 'crypto'
import { expect } from 'chai'

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
})
