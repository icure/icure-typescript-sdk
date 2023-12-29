import {
  createUserInMultipleGroups,
  describeNoLite,
  getEnvironmentInitializer,
  setLocalStorage,
  UserInManyGroupsDetails,
} from '../../utils/test_utils'
import { getEnvVariables } from '@icure/test-setup/types'
import 'isomorphic-fetch'
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
import { AuthSecretDetails, AuthSecretType, SmartAuthProvider } from '../../../icc-x-api/auth/SmartAuthProvider'

chaiUse(chaiAsPromised)

setLocalStorage(fetch)

let host: string
let userDetails: UserInManyGroupsDetails

describeNoLite('Authentication providers should be able to switch group', function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    const env = await initializer.execute(getEnvVariables())
    host = env.iCureUrl
    userDetails = await createUserInMultipleGroups(env)
    console.log('Users created')
  })

  const authenticationProviders: [string, () => AuthenticationProvider][] = [
    ['Basic', () => new BasicAuthenticationProvider(userDetails.userLogin, userDetails.userPw12)],
    [
      'Jwt',
      () =>
        new JwtAuthenticationProvider(new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetch), userDetails.userLogin, userDetails.userPw12),
    ],
    [
      'Ensemble',
      () =>
        new EnsembleAuthenticationProvider(
          new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetch),
          userDetails.userLogin,
          userDetails.userPw12
        ),
    ],
    [
      'Smart',
      () =>
        SmartAuthProvider.initialise(new IccAuthApi(host, {}, new NoAuthenticationProvider(), fetch), userDetails.userLogin, {
          getSecret(acceptedSecrets: AuthSecretType[], previousAttempts: AuthSecretDetails[]): Promise<AuthSecretDetails> {
            expect(acceptedSecrets).to.include(AuthSecretType.PASSWORD)
            return Promise.resolve({ value: userDetails.userPw12, secretType: AuthSecretType.PASSWORD })
          },
        }),
    ],
  ]

  for (const [providerType, providerFactory] of authenticationProviders) {
    it(`should be able to switch to another group if the username-password is the same in the new group (${providerType})`, async () => {
      const provider = providerFactory()
      const initialUserApi = new IccUserApi(host, {}, provider, fetch)
      const initialUser = await initialUserApi.getCurrentUser()
      expect(initialUser.id).to.be.oneOf([userDetails.user1.id, userDetails.user2.id])
      const matches = await initialUserApi.getMatchingUsers()
      expect(matches.map((x) => x.userId)).to.have.members([userDetails.user1.id, userDetails.user2.id])
      const switchedToGroup2Provider = await provider.switchGroup(userDetails.group2.id!, matches)
      const userApiGroup2 = new IccUserApi(host, {}, switchedToGroup2Provider, fetch)
      const userGroup2 = await userApiGroup2.getCurrentUser()
      expect(userGroup2.id).to.equal(userDetails.user2.id)
      const switchedToGroup1Provider = await switchedToGroup2Provider.switchGroup(userDetails.group1.id!, matches)
      const userApiGroup1 = new IccUserApi(host, {}, switchedToGroup1Provider, fetch)
      const userGroup1 = await userApiGroup1.getCurrentUser()
      expect(userGroup1.id).to.equal(userDetails.user1.id)
    })

    it(`should not be able to switch to another group if the username-password is different in the new group (${providerType})`, async () => {
      const provider = providerFactory()
      const initialUserApi = new IccUserApi(host, {}, provider, fetch)
      const matches = await initialUserApi.getMatchingUsers()
      expect(matches.map((x) => x.userId)).to.not.contain(userDetails.user3.id)
      await expect(provider.switchGroup(userDetails.group3.id!, matches)).to.be.rejected
    })
  }
})
