import { CryptoPrimitives, hex2ua, IcureApi, IcureApiOptions, RSAUtils, ua2hex } from '../../icc-x-api'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { v4 as uuid } from 'uuid'
import { webcrypto } from 'crypto'
import { TestApi } from './TestApi'
import { IcureApi as TestSetupApi } from '@icure/api'
import { testStorageWithKeys } from './TestStorage'
import { TestCryptoStrategies } from './TestCryptoStrategies'
import { User } from '../../icc-api/model/User'
import { TestEnvironmentBuilder } from '@icure/test-setup/builder'
import { getEnvVariables, TestVars, UserDetails } from '@icure/test-setup/types'
import { EnvInitializer } from '@icure/test-setup/decorators'
import 'isomorphic-fetch'
import { createPatientUser } from '@icure/test-setup/creation'

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

export const deviceUsername = getTempEmail()

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
        hcp: ['BASIC_USER', 'BASIC_DATA_OWNER', 'PATIENT_USER_MANAGER', 'HIERARCHICAL_DATA_OWNER', 'TOPIC_MANAGER', 'TOPIC_PARTICIPANT'],
        device: ['BASIC_USER', 'BASIC_DATA_OWNER'],
        user: ['BASIC_USER'],
      })
      .withMasterUser(fetch)
      .addHcp({ login: hcp1Username })
      .addHcp({ login: hcp2Username })
      .addHcp({ login: hcp3Username })
      .addPatient({ login: patUsername })
      .addDevice({ login: deviceUsername })
      .withSafeguard()
      .withEnvironmentSummary()
      .build()
  }
  return cachedInitializer
}

export namespace TestUtils {
  export async function initApi(envVars: TestVars, userName: string = hcp1Username, options?: IcureApiOptions): Promise<IcureApi> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.dataOwnerDetails[userName], options)
  }

  export async function initMasterApi(envVars: TestVars, options?: IcureApiOptions): Promise<IcureApi> {
    return await getApiAndAddPrivateKeysForUser(envVars.iCureUrl, envVars.masterHcp!, options)
  }
}

export async function getApiAndAddPrivateKeysForUser(iCureUrl: string, details: UserDetails, options?: IcureApiOptions) {
  const RSA = new RSAUtils(webcrypto as any)
  const keys = {
    publicKey: await RSA.importKey('spki', hex2ua(details.publicKey), ['encrypt'], 'sha-1'),
    privateKey: await RSA.importKey('pkcs8', hex2ua(details.privateKey), ['decrypt'], 'sha-1'),
  }
  return await TestApi(iCureUrl, details.user, details.password, webcrypto as any, keys, options)
}

async function createHealthcarePartyUser(
  api: TestSetupApi,
  userLogin: string,
  userToken: string,
  publicKey?: string,
  privateKey?: string
): Promise<UserDetails> {
  const { publicKey: newPublicKey, privateKey: newPrivateKey } = await api.cryptoApi.RSA.generateKeyPair()

  const publicKeyHex = !!publicKey && !!privateKey ? publicKey : ua2hex(await api.cryptoApi.RSA.exportKey(newPublicKey, 'spki'))
  const privateKeyHex = !!publicKey && !!privateKey ? privateKey : ua2hex(await api.cryptoApi.RSA.exportKey(newPrivateKey, 'pkcs8'))

  const hcp = await api.healthcarePartyApi.createHealthcareParty({
    id: uuid(),
    firstName: uuid().substring(0, 6),
    lastName: uuid().substring(0, 6),
    publicKey: publicKeyHex,
  })
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
  api: IcureApi
  credentials: UserDetails
  user: User
}> {
  const initialisationApi = await testSetupMasterApi(env)
  const primitives = new CryptoPrimitives(webcrypto as any)
  const credentials = await createHealthcarePartyUser(initialisationApi, `user-${primitives.randomUuid()}`, primitives.randomUuid())
  const storage = await testStorageWithKeys([
    {
      dataOwnerId: credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: credentials.privateKey, publicKey: credentials.publicKey }, shaVersion: 'sha-1' }],
    },
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

export async function createNewPatientApi(env: TestVars): Promise<{
  api: IcureApi
  credentials: UserDetails
  user: User
}> {
  const initialisationApi = await testSetupMasterApi(env)
  const primitives = new CryptoPrimitives(webcrypto as any)
  const credentials = await createPatientUser(initialisationApi, `user-${primitives.randomUuid()}`, primitives.randomUuid())
  const storage = await testStorageWithKeys([
    {
      dataOwnerId: credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: credentials.privateKey, publicKey: credentials.publicKey }, shaVersion: 'sha-1' }],
    },
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

/**
 * Creates a hierarchy of HCPs with the following structure:
 * grand HCP -+-> parent HCP ---> child HCP
 *            |
 *            +-> child2 HCP
 */
export async function createHcpHierarchyApis(
  env: TestVars,
  setupAutodelegations: boolean = true,
  disableParentKeysInitialisation: boolean = false
): Promise<{
  grandApi: IcureApi
  grandUser: User
  grandCredentials: UserDetails
  parentApi: IcureApi
  parentUser: User
  parentCredentials: UserDetails
  childApi: IcureApi
  childUser: User
  childCredentials: UserDetails
  child2Api: IcureApi
  child2User: User
  child2Credentials: UserDetails
}> {
  const shaVersion = 'sha-1'
  const initialisationApi = await testSetupMasterApi(env)
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
      disableParentKeysInitialisation,
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
      disableParentKeysInitialisation,
    }
  )
  const parentUser = setupAutodelegations
    ? await parentApi.userApi.modifyUser({
        ...(await parentApi.userApi.getCurrentUser()),
        autoDelegations: { all: [grandCredentials.dataOwnerId] },
      })
    : await parentApi.userApi.getCurrentUser()
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
      disableParentKeysInitialisation,
    }
  )
  const childUser = setupAutodelegations
    ? await childApi.userApi.modifyUser({
        ...(await childApi.userApi.getCurrentUser()),
        autoDelegations: { all: [grandCredentials.dataOwnerId, parentCredentials.dataOwnerId] },
      })
    : await childApi.userApi.getCurrentUser()
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
      disableParentKeysInitialisation,
    }
  )
  const child2User = setupAutodelegations
    ? await child2Api.userApi.modifyUser({
        ...(await child2Api.userApi.getCurrentUser()),
        autoDelegations: { all: [grandCredentials.dataOwnerId] },
      })
    : await child2Api.userApi.getCurrentUser()
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
  const initialisationApi = await testSetupMasterApi(env)
  const primitives = new CryptoPrimitives(webcrypto as any)
  const parentCredentials = await createHealthcarePartyUser(initialisationApi, `parent-${primitives.randomUuid()}`, primitives.randomUuid())
  const childUser = uuid() + '@email.com'
  const childPassword = uuid()
  const childHcp = {
    id: uuid(),
    firstName: uuid().substring(0, 6),
    lastName: uuid().substring(0, 6),
    parentId: parentCredentials.dataOwnerId,
    publicKey: undefined as string | undefined,
  }
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

function testSetupMasterApi(env: TestVars): Promise<TestSetupApi> {
  return TestSetupApi.initialise(
    env.iCureUrl,
    { username: env.masterHcp!.user, password: env.masterHcp!.password },
    {
      generateNewKeyForDataOwner(): Promise<boolean> {
        return Promise.resolve(true)
      },
      recoverAndVerifySelfHierarchyKeys(): never {
        throw new Error('Unsupported')
      },
      verifyDelegatePublicKeys(delegate: any, publicKeys: string[]): Promise<string[]> {
        return Promise.resolve(publicKeys)
      },
    },
    webcrypto as any,
    fetch
  )
}
