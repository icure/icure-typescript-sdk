import { Api, Apis, hex2ua, ua2hex } from '../../icc-x-api'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { v4 as uuid } from 'uuid'
import { webcrypto } from 'crypto'
import { RSAUtils } from '../../icc-x-api/crypto/RSA'
import { TestApi } from './TestApi'
import { Api as TestSetupApi, Apis as TestSetupApis } from '@icure/apiV6'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { testStorageWithKeys } from './TestStorage'
import { TestCryptoStrategies } from './TestCryptoStrategies'
import { User } from '../../icc-api/model/User'
import { TestEnvironmentBuilder } from '@icure/test-setup/builder'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { EnvInitializer } from '@icure/test-setup/decorators'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'

export function getTempEmail(): string {
  return `${uuid().substring(0, 8)}@icure.com`
}

export function setLocalStorage(fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
  ;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 ** 3)
  ;(global as any).fetch = fetch
  ;(global as any).Storage = ''
  ;(global as any).TextDecoder = TextDecoder
  ;(global as any).TextEncoder = TextEncoder
  ;(global as any).headers = Headers
}

export const hcp1Username = process.env.ICURE_TS_TEST_HCP_USER ?? getTempEmail()
export const hcp2Username = process.env.ICURE_TS_TEST_HCP_2_USER ?? getTempEmail()
export const hcp3Username = process.env.ICURE_TS_TEST_HCP_3_USER ?? getTempEmail()
export const patUsername = process.env.ICURE_TS_TEST_PAT_USER ?? getTempEmail()

let cachedInitializer: EnvInitializer | undefined

export async function getEnvironmentInitializer(): Promise<EnvInitializer> {
  if (!cachedInitializer) {
    const env = getEnvVariables()
    const scratchDir = 'test/scratch'
    const baseEnvironment =
      env.testEnvironment === 'docker' ? new TestEnvironmentBuilder().setUpDockerEnvironment(scratchDir, ['mock']) : new TestEnvironmentBuilder()
    cachedInitializer = await baseEnvironment
      .withGroup(fetch)
      .withMasterUser(fetch)
      .addHcp({ login: hcp1Username })
      .addHcp({ login: hcp2Username })
      .addHcp({ login: hcp3Username })
      .addPatient({ login: patUsername })
      .withSafeguard()
      .withEnvironmentSummary()
      .build()
  }
  return cachedInitializer
}

export namespace TestUtils {
  export async function initApi(envVars: TestVars, userName: string = hcp1Username): Promise<Apis> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.dataOwnerDetails[userName])
  }

  export async function initMasterApi(envVars: TestVars): Promise<Apis> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.masterHcp!)
  }
}

export async function getApiAndAddPrivateKeysForUser(iCureUrl: string, details: UserDetails) {
  const RSA = new RSAUtils(webcrypto as any)
  const keys = {
    publicKey: await RSA.importKey('spki', hex2ua(details.publicKey), ['encrypt'], 'sha-1'),
    privateKey: await RSA.importKey('pkcs8', hex2ua(details.privateKey), ['decrypt'], 'sha-1'),
  }
  return await TestApi(iCureUrl, details.user, details.password, webcrypto as any, keys)
}

async function createHealthcarePartyUser(
  api: TestSetupApis,
  userLogin: string,
  userToken: string,
  publicKey?: string,
  privateKey?: string
): Promise<UserDetails> {
  const { publicKey: newPublicKey, privateKey: newPrivateKey } = await api.cryptoApi.RSA.generateKeyPair()

  const publicKeyHex = !!publicKey && !!privateKey ? publicKey : ua2hex(await api.cryptoApi.RSA.exportKey(newPublicKey, 'spki'))
  const privateKeyHex = !!publicKey && !!privateKey ? privateKey : ua2hex(await api.cryptoApi.RSA.exportKey(newPrivateKey, 'pkcs8'))

  const hcp = await api.healthcarePartyApi.createHealthcareParty(
    new HealthcareParty({
      id: uuid(),
      firstName: uuid().substring(0, 6),
      lastName: uuid().substring(0, 6),
      publicKey: publicKeyHex,
    })
  )
  const hcpUser = await api.userApi.createUser(
    new User({
      id: uuid(),
      name: userLogin,
      login: userLogin,
      email: userLogin,
      healthcarePartyId: hcp.id,
    })
  )
  const token = await api.userApi.getToken(hcpUser.id!, uuid(), 24 * 60 * 60, userToken)
  return {
    user: hcpUser.login!,
    dataOwnerId: hcp.id!,
    password: token,
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
  }
}

export async function createNewHcpApi(env: TestVars): Promise<{
  api: Apis
  credentials: UserDetails
  user: User
}> {
  const initialisationApi = await TestSetupApi(
    env.iCureUrl + '/rest/v1',
    env.masterHcp!.user,
    env.masterHcp!.password,
    webcrypto as any,
    fetch,
    true,
    false
  )
  const primitives = new CryptoPrimitives(webcrypto as any)
  const credentials = await createHealthcarePartyUser(initialisationApi, `user-${primitives.randomUuid()}`, primitives.randomUuid())
  const storage = await testStorageWithKeys([
    {
      dataOwnerId: credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: credentials.privateKey, publicKey: credentials.publicKey }, shaVersion: 'sha-1' }],
    },
  ])
  const api = await Api(
    env.iCureUrl,
    { username: credentials.user, password: credentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    {
      storage: storage.storage,
      keyStorage: storage.keyStorage,
      entryKeysFactory: storage.keyFactory,
    }
  )
  return { api, credentials, user: await api.userApi.getCurrentUser() }
}

export async function createHcpHierarchyApis(env: TestVars): Promise<{
  grandApi: Apis
  grandUser: User
  grandCredentials: UserDetails
  parentApi: Apis
  parentUser: User
  parentCredentials: UserDetails
  childApi: Apis
  childUser: User
  childCredentials: UserDetails
  child2Api: Apis
  child2User: User
  child2Credentials: UserDetails
}> {
  const shaVersion = 'sha-1'
  const initialisationApi = await TestSetupApi(
    env.iCureUrl + '/rest/v1',
    env.masterHcp!.user,
    env.masterHcp!.password,
    webcrypto as any,
    fetch,
    true,
    false
  )
  const primitives = new CryptoPrimitives(webcrypto as any)
  const grandCredentials = await createHealthcarePartyUser(initialisationApi, `grand-${primitives.randomUuid()}`, primitives.randomUuid())
  const parentCredentials = await createHealthcarePartyUser(initialisationApi, `parent-${primitives.randomUuid()}`, primitives.randomUuid())
  const childCredentials = await createHealthcarePartyUser(initialisationApi, `child-${primitives.randomUuid()}`, primitives.randomUuid())
  const child2Credentials = await createHealthcarePartyUser(initialisationApi, `child2-${primitives.randomUuid()}`, primitives.randomUuid())
  await initialisationApi.healthcarePartyApi.modifyHealthcareParty({
    ...(await initialisationApi.healthcarePartyApi.getHealthcareParty(parentCredentials.dataOwnerId)),
    parentId: grandCredentials.dataOwnerId,
  })
  await initialisationApi.healthcarePartyApi.modifyHealthcareParty({
    ...(await initialisationApi.healthcarePartyApi.getHealthcareParty(childCredentials.dataOwnerId)),
    parentId: parentCredentials.dataOwnerId,
  })
  await initialisationApi.healthcarePartyApi.modifyHealthcareParty({
    ...(await initialisationApi.healthcarePartyApi.getHealthcareParty(child2Credentials.dataOwnerId)),
    parentId: grandCredentials.dataOwnerId,
  })
  const grandStorage = await testStorageWithKeys([
    {
      dataOwnerId: grandCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }, shaVersion: shaVersion }],
    },
  ])
  const grandApi = await Api(
    env.iCureUrl,
    { username: grandCredentials.user, password: grandCredentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    {
      storage: grandStorage.storage,
      keyStorage: grandStorage.keyStorage,
      entryKeysFactory: grandStorage.keyFactory,
    }
  )
  const parentStorage = await testStorageWithKeys([
    {
      dataOwnerId: grandCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }, shaVersion: shaVersion }],
    },
    {
      dataOwnerId: parentCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey }, shaVersion: shaVersion }],
    },
  ])
  const parentApi = await Api(
    env.iCureUrl,
    { username: parentCredentials.user, password: parentCredentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    {
      storage: parentStorage.storage,
      keyStorage: parentStorage.keyStorage,
      entryKeysFactory: parentStorage.keyFactory,
    }
  )
  const parentUser = await parentApi.userApi.modifyUser({
    ...(await parentApi.userApi.getCurrentUser()),
    autoDelegations: { all: [grandCredentials.dataOwnerId] },
  })
  const childStorage = await testStorageWithKeys([
    {
      dataOwnerId: grandCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }, shaVersion: shaVersion }],
    },
    {
      dataOwnerId: parentCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey }, shaVersion: shaVersion }],
    },
    {
      dataOwnerId: childCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: childCredentials.privateKey, publicKey: childCredentials.publicKey }, shaVersion: shaVersion }],
    },
  ])
  const childApi = await Api(
    env.iCureUrl,
    { username: childCredentials.user, password: childCredentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    {
      storage: childStorage.storage,
      keyStorage: childStorage.keyStorage,
      entryKeysFactory: childStorage.keyFactory,
    }
  )
  const childUser = await childApi.userApi.modifyUser({
    ...(await childApi.userApi.getCurrentUser()),
    autoDelegations: { all: [grandCredentials.dataOwnerId, parentCredentials.dataOwnerId] },
  })
  const child2Storage = await testStorageWithKeys([
    {
      dataOwnerId: grandCredentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }, shaVersion: shaVersion }],
    },
    {
      dataOwnerId: child2Credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: child2Credentials.privateKey, publicKey: child2Credentials.publicKey }, shaVersion: shaVersion }],
    },
  ])
  const child2Api = await Api(
    env.iCureUrl,
    { username: child2Credentials.user, password: child2Credentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    {
      storage: child2Storage.storage,
      keyStorage: child2Storage.keyStorage,
      entryKeysFactory: child2Storage.keyFactory,
    }
  )
  const child2User = await child2Api.userApi.modifyUser({
    ...(await child2Api.userApi.getCurrentUser()),
    autoDelegations: { all: [grandCredentials.dataOwnerId] },
  })
  return {
    grandApi,
    grandUser: await grandApi.userApi.getCurrentUser(),
    grandCredentials,
    parentApi,
    parentUser,
    parentCredentials,
    childApi,
    childUser,
    childCredentials,
    child2Api,
    child2User,
    child2Credentials,
  }
}
