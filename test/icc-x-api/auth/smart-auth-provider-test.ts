import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { before } from 'mocha'
import { createNewHcpApi, createUserInMultipleGroups, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { AuthenticationProvider, BasicAuthenticationProvider, NoAuthenticationProvider } from '../../../icc-x-api'
import { IccAuthApi, IccUserApi } from '../../../icc-api'
import 'isomorphic-fetch'
import { AuthSecretType, SmartAuthProvider } from '../../../icc-x-api/auth/SmartAuthProvider'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import initMasterApi = TestUtils.initMasterApi
import { fail } from 'assert'
import { TOTP } from 'otpauth'
setLocalStorage(fetch)

let env: TestVars
let authApi: IccAuthApi

describe('Smart authentication provider', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    authApi = new IccAuthApi(env.iCureUrl, {}, new NoAuthenticationProvider(), fetch)
  })

  function userApiWithProvider(authProvider: AuthenticationProvider): IccUserApi {
    return new IccUserApi(env.iCureUrl, {}, authProvider, fetch)
  }

  it('Should automatically ask for secret to get a new token, and reasks the secret if it is not valid', async () => {
    const { credentials } = await createNewHcpApi(env)
    let calls = 0
    const authProvider = SmartAuthProvider.initialise(authApi, credentials.user, {
      getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: { secret: string; secretType: AuthSecretType }[]) => {
        expect(acceptedSecrets).to.include(AuthSecretType.PASSWORD)
        expect(acceptedSecrets).to.include(AuthSecretType.LONG_LIVED_TOKEN)
        expect(acceptedSecrets).to.include(AuthSecretType.SHORT_LIVED_TOKEN)
        expect(acceptedSecrets).to.not.include(AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
        if (calls == 0) {
          expect(previousAttempts).to.be.empty
        } else if (calls == 1) {
          expect(previousAttempts).to.have.length(1)
          expect(previousAttempts[0].secret).to.equal('wrong')
          expect(previousAttempts[0].secretType).to.equal(AuthSecretType.LONG_LIVED_TOKEN)
        } else fail(`Unexpected number of calls: ${calls}`)
        return calls++ == 0
          ? { secret: 'wrong', secretType: AuthSecretType.LONG_LIVED_TOKEN } // pragma: allowlist secret
          : { secret: credentials.password, secretType: AuthSecretType.LONG_LIVED_TOKEN }
      },
    })
    const userApi = userApiWithProvider(authProvider)
    const user = await userApi.getCurrentUser()
    expect(user.healthcarePartyId).to.equal(credentials.dataOwnerId)
    expect(calls).to.equal(2)
  })

  it('Should automatically ask for a more powerful secret to perform elevated-security operations if the available secret/token is not good enough', async () => {
    const { credentials, api } = await createNewHcpApi(env)
    const initialUser = await api.userApi.getCurrentUser()
    const masterApi = await initMasterApi(env)
    const userToken = randomUUID()
    const userPw = randomUUID()
    const userWithLongTokenAndPw = await masterApi.userApi.modifyUser({
      ...initialUser,
      passwordHash: userPw,
      authenticationTokens: {
        'test-long-lived-token': {
          token: userToken,
          creationTime: Date.now(),
          validity: 60 * 60 * 24 * 7,
        },
      },
    })
    let calls = 0
    const authProvider = SmartAuthProvider.initialise(authApi, credentials.user, {
      getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: { secret: string; secretType: AuthSecretType }[]) => {
        if (calls == 0) {
          expect(acceptedSecrets).to.include(AuthSecretType.PASSWORD)
          expect(acceptedSecrets).to.include(AuthSecretType.LONG_LIVED_TOKEN)
          expect(acceptedSecrets).to.include(AuthSecretType.SHORT_LIVED_TOKEN)
          expect(acceptedSecrets).to.not.include(AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
          expect(previousAttempts).to.be.empty
          calls++
          return { secret: userToken, secretType: AuthSecretType.LONG_LIVED_TOKEN }
        } else if (calls == 1) {
          expect(acceptedSecrets).to.include(AuthSecretType.PASSWORD)
          expect(acceptedSecrets).to.not.include(AuthSecretType.LONG_LIVED_TOKEN)
          expect(acceptedSecrets).to.include(AuthSecretType.SHORT_LIVED_TOKEN)
          expect(acceptedSecrets).to.not.include(AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
          expect(previousAttempts).to.be.empty
          calls++
          return { secret: userPw, secretType: AuthSecretType.PASSWORD }
        } else throw new Error(`Unexpected number of calls: ${calls}`)
      },
    })
    const userApi = userApiWithProvider(authProvider)
    expect((await userApi.getCurrentUser()).rev).to.equal(userWithLongTokenAndPw.rev)
    expect(calls).to.equal(1)
    const newPw = randomUUID()
    const userWithNewPw = await userApi.modifyUser({ ...userWithLongTokenAndPw, passwordHash: newPw })
    expect(userWithNewPw.rev).to.not.equal(userWithLongTokenAndPw.rev)
    expect(calls).to.equal(2)
    const retrievedWithNewPw = await userApiWithProvider(new BasicAuthenticationProvider(credentials.user, newPw)).getCurrentUser()
    expect(retrievedWithNewPw.rev).to.equal(userWithNewPw.rev)
    const couldRetrieveWithOldPw = await userApiWithProvider(new BasicAuthenticationProvider(credentials.user, userPw))
      .getCurrentUser()
      .then(
        () => true,
        () => false
      )
    expect(couldRetrieveWithOldPw).to.be.false
  })

  it('Should automatically ask for TOTP after password if user has 2fa enabled', async () => {
    const { credentials, api } = await createNewHcpApi(env)
    const initialUser = await api.userApi.getCurrentUser()
    const masterApi = await initMasterApi(env)
    const totpSecret = 'AAPX7PW2RJIGZ3D4' // pragma: allowlist secret (fake secret generated only for test)
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: totpSecret,
    })
    const userPw = randomUUID()
    const userWithPwAnd2fa = await masterApi.userApi.modifyUser({
      ...initialUser,
      passwordHash: userPw,
      use2fa: true,
      secret: totpSecret,
    })
    let calls = 0
    const authProvider = SmartAuthProvider.initialise(authApi, credentials.user, {
      getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: { secret: string; secretType: AuthSecretType }[]) => {
        if (calls == 0) {
          expect(acceptedSecrets).to.include(AuthSecretType.PASSWORD)
          expect(acceptedSecrets).to.include(AuthSecretType.LONG_LIVED_TOKEN)
          expect(acceptedSecrets).to.include(AuthSecretType.SHORT_LIVED_TOKEN)
          expect(acceptedSecrets).to.not.include(AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
          expect(previousAttempts).to.be.empty
          calls++
          return { secret: userPw, secretType: AuthSecretType.PASSWORD }
        } else if (calls == 1 || calls == 2) {
          expect(acceptedSecrets).to.have.members([AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN])
          if (calls == 1) expect(previousAttempts).to.be.empty
          if (calls == 2) expect(previousAttempts).to.have.length(1)
          return calls++ == 1
            ? { secret: totp.generate() + '13', secretType: AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN }
            : { secret: totp.generate(), secretType: AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN }
        } else throw new Error(`Unexpected number of calls: ${calls}`)
      },
    })
    const userApi = userApiWithProvider(authProvider)
    expect((await userApi.getCurrentUser()).rev).to.equal(userWithPwAnd2fa.rev)
    expect(calls).to.equal(3)
  })

  it('Should ask for TOTP directly if password is cached', async () => {
    const { credentials, api } = await createNewHcpApi(env)
    const initialUser = await api.userApi.getCurrentUser()
    const masterApi = await initMasterApi(env)
    const totpSecret = 'AAPX7PW2RJIGZ3D4' // pragma: allowlist secret (fake secret generated only for test)
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: totpSecret,
    })
    const userPw = randomUUID()
    const userWithPwAnd2fa = await masterApi.userApi.modifyUser({
      ...initialUser,
      passwordHash: userPw,
      use2fa: true,
      secret: totpSecret,
    })
    let calls = 0
    const authProvider = SmartAuthProvider.initialise(
      authApi,
      credentials.user,
      {
        getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: { secret: string; secretType: AuthSecretType }[]) => {
          expect(acceptedSecrets).to.have.members([AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN])
          expect(previousAttempts).to.be.empty
          expect(calls++).to.equal(0)
          return { secret: totp.generate(), secretType: AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN }
        },
      },
      {
        initialSecret: userPw,
      }
    )
    const userApi = userApiWithProvider(authProvider)
    expect((await userApi.getCurrentUser()).rev).to.equal(userWithPwAnd2fa.rev)
    expect(calls).to.equal(1)
  })

  it('Switched provider should keep cached secrets and should be able to have elevated security context', async () => {
    const details = await createUserInMultipleGroups(env)
    let calls = 0
    const authProvider = SmartAuthProvider.initialise(authApi, details.userLogin, {
      getSecret: async (acceptedSecrets: AuthSecretType[], previousAttempts: { secret: string; secretType: AuthSecretType }[]) => {
        expect(acceptedSecrets).to.have.include(AuthSecretType.PASSWORD)
        expect(previousAttempts).to.be.empty
        expect(calls++).to.equal(0)
        return { secret: details.userPw12, secretType: AuthSecretType.PASSWORD }
      },
    })
    const defaultGroupUserApi = userApiWithProvider(authProvider)
    const defaultGroupUser = await defaultGroupUserApi.getCurrentUser()
    const otherGroupId = details.group1.id == defaultGroupUser.groupId ? details.group2.id : details.group1.id
    const matches = await defaultGroupUserApi.getMatchingUsers()
    const switchedUserApi = userApiWithProvider(await authProvider.switchGroup(otherGroupId!, matches))
    const switchedUser = await switchedUserApi.getCurrentUser()
    expect(switchedUser.id).to.not.equal(defaultGroupUser.id)
    expect(switchedUser.groupId).to.equal(otherGroupId)
    const updatedDefault = await switchedUserApi.modifyUser({
      ...switchedUser,
      authenticationTokens: {
        'new-token': {
          token: randomUUID(),
          creationTime: Date.now(),
          validity: 60 * 60 * 24 * 7,
        },
      },
    })
    expect(updatedDefault.rev).to.not.equal(switchedUser.rev)
    expect(Object.keys(updatedDefault.authenticationTokens ?? {})).to.not.be.empty
  })
})
