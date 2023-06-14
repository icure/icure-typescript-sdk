import { getEnvironmentInitializer, setLocalStorage } from '../../utils/test_utils'
import { getEnvVariables } from '@icure/test-setup/types'
import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { BasicApis, retry } from '../../../icc-x-api'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { IccAuthApi, IccUserApi } from '../../../icc-api'
import {
  AuthenticationProvider,
  BasicAuthenticationProvider,
  EnsembleAuthenticationProvider,
  JwtAuthenticationProvider,
  NoAuthenticationProvider,
} from '../../../icc-x-api/auth/AuthenticationProvider'
import { expect, use as chaiUse } from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
chaiUse(chaiAsPromised)

setLocalStorage(fetch)

let host: string

describe('Authentication providers should be able to switch group', function () {
  const primitives = new CryptoPrimitives(webcrypto as any)
  const userGroup1Id: string = primitives.randomUuid() // Same username-pw as group 2
  const userGroup2Id: string = primitives.randomUuid() // Same username-pw as group 1
  const userGroup3Id: string = primitives.randomUuid() // Same username as group 1/2, different pw
  const userLogin: string = `maria-${primitives.randomUuid()}@pompei.it`
  const userPw12: string = `geppetto-${primitives.randomUuid()}`
  const userPw3: string = `pinocchio-${primitives.randomUuid()}`
  const user1Id: string = primitives.randomUuid()
  const user2Id: string = primitives.randomUuid()
  const user3Id: string = primitives.randomUuid()
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    const env = await initializer.execute(getEnvVariables())
    host = env.iCureUrl
    const api = await BasicApis(env.iCureUrl, 'john', 'LetMeIn', webcrypto as any, fetch)
    await api.groupApi.createGroup(
      userGroup1Id,
      `test-group-1-${primitives.randomUuid()}`,
      primitives.randomUuid(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {}
    )
    await api.groupApi.createGroup(
      userGroup2Id,
      `test-group-2-${primitives.randomUuid()}`,
      primitives.randomUuid(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {}
    )
    await api.groupApi.createGroup(
      userGroup3Id,
      `test-group-3-${primitives.randomUuid()}`,
      primitives.randomUuid(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {}
    )
    await api.userApi.createUserInGroup(userGroup1Id, {
      id: user1Id,
      name: userLogin,
      login: userLogin,
      email: userLogin,
      passwordHash: userPw12,
    })
    await api.userApi.createUserInGroup(userGroup2Id, {
      id: user2Id,
      name: userLogin,
      login: userLogin,
      email: userLogin,
      passwordHash: userPw12,
    })
    await api.userApi.createUserInGroup(userGroup3Id, {
      id: user3Id,
      name: userLogin,
      login: userLogin,
      email: userLogin,
      passwordHash: userPw3,
    })
    console.log(`Waiting for user to be created - ${userLogin}`)
    await retry(
      async () => {
        await new IccUserApi(host, {}, new BasicAuthenticationProvider(`${userGroup1Id}/${user1Id}`, userPw12), fetch).getCurrentUser()
        await new IccUserApi(host, {}, new BasicAuthenticationProvider(`${userGroup2Id}/${user2Id}`, userPw12), fetch).getCurrentUser()
        await new IccUserApi(host, {}, new BasicAuthenticationProvider(`${userGroup3Id}/${user3Id}`, userPw3), fetch).getCurrentUser()
      },
      10,
      5_000,
      1
    )
    console.log('Users created')
  })

  const authenticationProviders: [string, () => AuthenticationProvider][] = [
    ['Basic', () => new BasicAuthenticationProvider(userLogin, userPw12)],
    ['Jwt', () => new JwtAuthenticationProvider(new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetch), userLogin, userPw12)],
    ['Ensemble', () => new EnsembleAuthenticationProvider(new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetch), userLogin, userPw12)],
  ]

  for (const [providerType, providerFactory] of authenticationProviders) {
    it(`should be able to switch to another group if the username-password is the same in the new group (${providerType})`, async () => {
      const provider = providerFactory()
      const initialUserApi = new IccUserApi(host, {}, provider, fetch)
      const initialUser = await initialUserApi.getCurrentUser()
      expect(initialUser.id).to.be.oneOf([user1Id, user2Id])
      const matches = await initialUserApi.getMatchingUsers()
      expect(matches.map((x) => x.userId)).to.have.members([user1Id, user2Id])
      const switchedToGroup2Provider = await provider.switchGroup(userGroup2Id, matches)
      const userApiGroup2 = new IccUserApi(host, {}, switchedToGroup2Provider, fetch)
      const userGroup2 = await userApiGroup2.getCurrentUser()
      expect(userGroup2.id).to.equal(user2Id)
      const switchedToGroup1Provider = await switchedToGroup2Provider.switchGroup(userGroup1Id, matches)
      const userApiGroup1 = new IccUserApi(host, {}, switchedToGroup1Provider, fetch)
      const userGroup1 = await userApiGroup1.getCurrentUser()
      expect(userGroup1.id).to.equal(user1Id)
    })

    it(`should not be able to switch to another group if the username-password is different in the new group (${providerType})`, async () => {
      const provider = providerFactory()
      const initialUserApi = new IccUserApi(host, {}, provider, fetch)
      const matches = await initialUserApi.getMatchingUsers()
      expect(matches.map((x) => x.userId)).to.not.contain(user3Id)
      await expect(provider.switchGroup(userGroup3Id, matches)).to.be.rejected
    })
  }
})
