import {getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils} from '../utils/test_utils'
import {before} from 'mocha'
import {crypto} from '../../node-compat'
import {TestApi} from '../utils/TestApi'
import {getEnvVariables, TestVars} from '@icure/test-setup/types'
import {CryptoPrimitives} from "../../icc-x-api"
import {webcrypto} from "crypto"
import {expect} from "chai"
import {User} from "../../icc-api/model/User"
import {v4 as uuid} from "uuid"
import initMasterApi = TestUtils.initMasterApi

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

  it('Can get an user by its phoneNumber', async () => {
    const primitives = new CryptoPrimitives(webcrypto as any)
    const phoneNumber = `+${primitives.randomUuid()}`

    const api = await initMasterApi(env)

    const createdUser = await api.userApi.createUser(
      new User({
        id: uuid(),
        name: `user-${primitives.randomUuid()}`,
        login: `user-${primitives.randomUuid()}`,
        email: `user-${primitives.randomUuid()}@icure.com`,
        mobilePhone: phoneNumber,
      })
    )

    const user = await api.userApi.getUserByPhoneNumber(phoneNumber)

    expect(user).to.be.deep.equal({
      ...createdUser,
      systemMetadata: user.systemMetadata
    })
  })
})
