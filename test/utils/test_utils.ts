import { BasicApis, BasicAuthenticationProvider, CryptoPrimitives, hex2ua, IcureApi, Apis, retry, RSAUtils, ua2hex } from '../../icc-x-api'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { v4 as uuid } from 'uuid'
import { webcrypto } from 'crypto'
import { TestApi } from './TestApi'
import { Api as TestSetupApi, Apis as TestSetupApis, HealthcareParty } from '@icure/apiV6'
import { testStorageWithKeys } from './TestStorage'
import { TestCryptoStrategies } from './TestCryptoStrategies'
import { User } from '../../icc-api/model/User'
import { TestEnvironmentBuilder } from '@icure/test-setup/builder'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { EnvInitializer } from '@icure/test-setup/decorators'
import 'isomorphic-fetch'
import { IccUserApi } from '../../icc-api'
import { Group } from '../../icc-api/model/Group'

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
      .withGroup(fetch, {
        patient: ['BASIC_USER', 'BASIC_DATA_OWNER'],
        hcp: [
          'BASIC_USER',
          'BASIC_DATA_OWNER',
          'PATIENT_USER_MANAGER',
          'HIERARCHICAL_DATA_OWNER',
          'TOPIC_MANAGER',
          'TOPIC_PARTICIPANT',
          'LEGACY_MESSAGE_MANAGER',
        ],
        device: ['BASIC_USER', 'BASIC_DATA_OWNER'],
        user: ['BASIC_USER'],
      })
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
  export async function initApi(envVars: TestVars, userName: string = hcp1Username): Promise<IcureApi> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.dataOwnerDetails[userName])
  }

  export async function initMasterApi(envVars: TestVars): Promise<IcureApi> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.masterHcp!)
  }
}

export async function getApiAndAddPrivateKeysForUser(iCureUrl: string, details: UserDetails) {
  const RSA = new RSAUtils(webcrypto as any)
  const keys = {
    publicKey: await RSA.importKey('spki', hex2ua(details.publicKey), ['encrypt']),
    privateKey: await RSA.importKey('pkcs8', hex2ua(details.privateKey), ['decrypt']),
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
    { dataOwnerId: credentials.dataOwnerId, pairs: [{ privateKey: credentials.privateKey, publicKey: credentials.publicKey }] },
  ])
  const api = await IcureApi.initialise(
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
    { dataOwnerId: grandCredentials.dataOwnerId, pairs: [{ privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }] },
  ])
  const grandApi = await IcureApi.initialise(
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
    { dataOwnerId: grandCredentials.dataOwnerId, pairs: [{ privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }] },
    { dataOwnerId: parentCredentials.dataOwnerId, pairs: [{ privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey }] },
  ])
  const parentApi = await IcureApi.initialise(
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
    { dataOwnerId: grandCredentials.dataOwnerId, pairs: [{ privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }] },
    { dataOwnerId: parentCredentials.dataOwnerId, pairs: [{ privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey }] },
    { dataOwnerId: childCredentials.dataOwnerId, pairs: [{ privateKey: childCredentials.privateKey, publicKey: childCredentials.publicKey }] },
  ])
  const childApi = await IcureApi.initialise(
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
    { dataOwnerId: grandCredentials.dataOwnerId, pairs: [{ privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }] },
    { dataOwnerId: child2Credentials.dataOwnerId, pairs: [{ privateKey: child2Credentials.privateKey, publicKey: child2Credentials.publicKey }] },
  ])
  const child2Api = await IcureApi.initialise(
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

/**
 * Create a parent HCP with a key and a child HCP without any initialised key
 */
export async function createNewHcpWithoutKeyAndParentWithKey(
  env: TestVars,
  props: {
    initialiseEmptyKeyForChild?: boolean
  } = {}
): Promise<{
  parentCredentials: UserDetails
  childUser: string
  childDataOwnerId: string
  childPassword: string
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
  const parentCredentials = await createHealthcarePartyUser(initialisationApi, `parent-${primitives.randomUuid()}`, primitives.randomUuid())
  const childUser = uuid() + '@email.com'
  const childPassword = uuid()
  const childHcp = new HealthcareParty({
    id: uuid(),
    firstName: uuid().substring(0, 6),
    lastName: uuid().substring(0, 6),
    parentId: parentCredentials.dataOwnerId,
  })
  if (props.initialiseEmptyKeyForChild) {
    childHcp.publicKey = ''
  }
  await initialisationApi.healthcarePartyApi.createHealthcareParty(childHcp)
  await initialisationApi.userApi.createUser(
    new User({
      id: uuid(),
      name: childUser,
      login: childUser,
      email: childUser,
      passwordHash: childPassword,
      healthcarePartyId: childHcp.id,
    })
  )
  return {
    parentCredentials,
    childUser,
    childPassword,
    childDataOwnerId: childHcp.id!,
  }
}

export type UserInManyGroupsDetails = {
  user1: User
  user2: User
  group3: Group
  userPw3: string
  user3: User
  group2: Group
  group1: Group
  userPw12: string
  userLogin: string
}
export async function createUserInMultipleGroups(env: TestVars): Promise<UserInManyGroupsDetails> {
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
  const api = await BasicApis(env.iCureUrl, { username: 'john', password: 'LetMeIn' }, webcrypto as any, fetch) // pragma: allowlist secret
  const group1 = await api.groupApi.createGroup(
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
  const group2 = await api.groupApi.createGroup(
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
  const group3 = await api.groupApi.createGroup(
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
  const user1 = await api.userApi.createUserInGroup(userGroup1Id, {
    id: user1Id,
    name: userLogin,
    login: userLogin,
    email: userLogin,
    passwordHash: userPw12,
  })
  const user2 = await api.userApi.createUserInGroup(userGroup2Id, {
    id: user2Id,
    name: userLogin,
    login: userLogin,
    email: userLogin,
    passwordHash: userPw12,
  })
  const user3 = await api.userApi.createUserInGroup(userGroup3Id, {
    id: user3Id,
    name: userLogin,
    login: userLogin,
    email: userLogin,
    passwordHash: userPw3,
  })
  console.log(`Waiting for user to be created - ${userLogin}`)
  await retry(
    async () => {
      await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup1Id}/${user1Id}`, userPw12), fetch).getCurrentUser()
      await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup2Id}/${user2Id}`, userPw12), fetch).getCurrentUser()
      await new IccUserApi(env.iCureUrl, {}, new BasicAuthenticationProvider(`${userGroup3Id}/${user3Id}`, userPw3), fetch).getCurrentUser()
    },
    10,
    5_000,
    1
  )
  return {
    user1,
    user2,
    group3,
    userPw3,
    user3,
    group2,
    group1,
    userPw12,
    userLogin,
  }
}
