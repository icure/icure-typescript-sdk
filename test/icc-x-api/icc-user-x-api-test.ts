import { createNewHcpApi, getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { crypto } from '../../node-compat'
import { TestApi } from '../utils/TestApi'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { AuthenticationProvider, CryptoPrimitives, IccUserXApi, NoAuthenticationProvider } from '../../icc-x-api'
import { webcrypto } from 'crypto'
import { assert, expect } from 'chai'
import { User } from '../../icc-api/model/User'
import { v4 as uuid } from 'uuid'
import initMasterApi = TestUtils.initMasterApi
import { AuthSecretDetails, AuthSecretType, SmartAuthProvider } from '../../icc-x-api/auth/SmartAuthProvider'
import { randomUUID } from 'crypto'
import { IccAuthApi, IccUserApi } from '../../icc-api'

setLocalStorage(fetch)
let env: TestVars
let authApi: IccAuthApi

describe('icc-x-user-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    authApi = new IccAuthApi(env.iCureUrl, {}, new NoAuthenticationProvider(), fetch)
  })

  function userApiWithProvider(authProvider: AuthenticationProvider): IccUserApi {
    return new IccUserXApi(env.iCureUrl, {}, authProvider, new IccAuthApi(env.iCureUrl, {}, new NoAuthenticationProvider(), fetch))
  }

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
      systemMetadata: user.systemMetadata,
    })
  })

  it('Should automatically ask for a more powerful secret to perform elevated-security operations if the available secret/token is not good enough. When a new token is created during this process, the modifyUser does not fail with a 409', async () => {
    const { credentials, api } = await createNewHcpApi(env)
    const initialUser = await api.userApi.getCurrentUser()
    const masterApi = await initMasterApi(env)
    const userToken = randomUUID()
    const userWithLongToken = await masterApi.userApi.modifyUser({
      ...initialUser,
      authenticationTokens: {
        'test-long-lived-token': {
          token: userToken,
          creationTime: Date.now(),
          validity: 60 * 60 * 24 * 7,
        },
      },
    })
    let longLivedTokenRequested = false
    let shortLivedTokenRequested = false
    const authProvider = SmartAuthProvider.initialise(authApi, credentials.user, {
      getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: AuthSecretDetails[]) => {
        if (acceptedSecrets.includes(AuthSecretType.LONG_LIVED_TOKEN)) {
          longLivedTokenRequested = true
          return { value: userToken, secretType: AuthSecretType.LONG_LIVED_TOKEN }
        } else if (acceptedSecrets.includes(AuthSecretType.SHORT_LIVED_TOKEN)) {
          shortLivedTokenRequested = true
          await masterApi.userApi.getToken(userWithLongToken.id!, 'tmp', 300, '123456')
          return { value: '123456', secretType: AuthSecretType.SHORT_LIVED_TOKEN }
        } else assert.fail('Should request LONG_LIVED_TOKEN or SHORT_LIVED_TOKEN')
      },
    })
    const userApi = userApiWithProvider(authProvider)
    expect((await userApi.getCurrentUser()).rev).to.equal(userWithLongToken.rev)
    expect(longLivedTokenRequested).to.be.true
    expect(shortLivedTokenRequested).to.be.false

    const newPw = randomUUID()
    const userWithNewPw = await userApi.modifyUser({ ...userWithLongToken, passwordHash: newPw })

    expect(userWithNewPw.rev).to.not.equal(userWithLongToken.rev)
    expect(shortLivedTokenRequested).to.be.true
  })
})
