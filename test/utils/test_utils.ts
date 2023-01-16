import { Api, Apis, hex2ua } from '../../icc-x-api'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { v4 as uuid } from 'uuid'
import {
  CreateHcpComponent,
  CreatePatientComponent,
  DescribeInitializer,
  DockerComposeInitializer,
  EnvInitializer,
  GroupInitializer,
  KrakenInitializer,
  MasterUserInGroupInitializer,
  MasterUserInitializer,
  OssInitializer,
  SafeguardInitializer,
  UserInitializerComposite,
} from './test-utils-decorators'
import { webcrypto } from 'crypto'
import { checkIfDockerIsOnline } from '@icure/test-setup'
import { RSAUtils } from '../../icc-x-api/crypto/RSA'
import { TestApi } from './TestApi'
import { Api as TestSetupApi } from '@icure/apiV6'
import { createHealthcarePartyUser, UserCredentials } from '@icure/test-setup/creation'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { testStorageWithKeys } from './TestStorage'
import { TestCryptoStrategies } from './TestCryptoStrategies'
import { User } from '../../icc-api/model/User'

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

export type UserDetails = {
  user: string
  password: string
  publicKey: string
  privateKey: string
}

export type TestVars = {
  iCureUrl: string
  msgGtwUrl: string
  couchDbUrl: string
  composeFileUrl: string
  patAuthProcessId: string
  hcpAuthProcessId: string
  specId: string
  testEnvironment: string
  testGroupId: string
  backendType: string
  adminLogin: string
  adminPassword: string
  masterHcp: UserDetails | undefined
  dataOwnerDetails: { [key: string]: UserDetails }
}

export function getEnvVariables(): TestVars {
  const masterHcpDetails =
    !!process.env.ICURE_TEST_MASTER_LOGIN &&
    !!process.env.ICURE_TEST_MASTER_PWD &&
    !!process.env.ICURE_TEST_MASTER_PRIV &&
    !!process.env.ICURE_TEST_MASTER_PUB
      ? {
          user: process.env.ICURE_TEST_MASTER_LOGIN!,
          password: process.env.ICURE_TEST_MASTER_PWD!,
          privateKey: process.env.ICURE_TEST_MASTER_PRIV!,
          publicKey: process.env.ICURE_TEST_MASTER_PUB!,
        }
      : undefined
  const testGroupId = process.env.ICURE_TEST_GROUP_ID ?? 'test-group'
  return {
    iCureUrl: process.env.ICURE_TS_TEST_URL ?? 'http://127.0.0.1:16044/rest/v1',
    msgGtwUrl: process.env.ICURE_TS_TEST_MSG_GTW_URL ?? 'http://127.0.0.1:8081/msggtw',
    couchDbUrl: process.env.ICURE_COUCHDB_URL ?? 'http://127.0.0.1:15984',
    composeFileUrl: process.env.COMPOSE_FILE_URL ?? 'https://raw.githubusercontent.com/icure/icure-e2e-test-setup/master/docker-compose-cloud.yaml',
    patAuthProcessId: process.env.ICURE_TS_TEST_PAT_AUTH_PROCESS_ID ?? `patient${testGroupId}`,
    hcpAuthProcessId: process.env.ICURE_TS_TEST_HCP_AUTH_PROCESS_ID ?? `hcp${testGroupId}`,
    specId: process.env.ICURE_TS_TEST_MSG_GTW_SPEC_ID ?? 'ic',
    testEnvironment: process.env.TEST_ENVIRONMENT ?? 'docker',
    testGroupId: testGroupId,
    backendType: process.env.BACKEND_TYPE ?? 'kraken',
    adminLogin: process.env.ICURE_TEST_ADMIN_LOGIN ?? 'john',
    adminPassword: process.env.ICURE_TEST_ADMIN_PWD ?? 'LetMeIn',
    masterHcp: masterHcpDetails,
    dataOwnerDetails: {},
  }
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
    const isDockerOnline = await checkIfDockerIsOnline(scratchDir, env.composeFileUrl)
    let bootstrapStep = null
    if (env.testEnvironment === 'docker' && !isDockerOnline) {
      const setupStep = new DockerComposeInitializer(scratchDir, ['mock'])
      bootstrapStep = env.backendType === 'oss' ? new OssInitializer(setupStep) : new KrakenInitializer(setupStep)
    }
    const groupStep = env.backendType === 'oss' ? bootstrapStep : new GroupInitializer(bootstrapStep, fetch)
    const masterInitializerClass = env.backendType === 'kraken' ? MasterUserInGroupInitializer : MasterUserInitializer
    const masterStep = !!env.masterHcp ? groupStep : new masterInitializerClass(groupStep, fetch)
    const creationStep = new UserInitializerComposite(masterStep, fetch)
    creationStep.add(new CreateHcpComponent(hcp1Username))
    creationStep.add(new CreateHcpComponent(hcp2Username))
    creationStep.add(new CreateHcpComponent(hcp3Username))
    creationStep.add(new CreatePatientComponent(patUsername))
    const explanationStep = new DescribeInitializer(creationStep)
    cachedInitializer = new SafeguardInitializer(explanationStep)
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
    publicKey: await RSA.importKey('spki', hex2ua(details.publicKey), ['encrypt']),
    privateKey: await RSA.importKey('pkcs8', hex2ua(details.privateKey), ['decrypt']),
  }
  return await TestApi(iCureUrl, details.user, details.password, webcrypto as any, keys)
}

export async function createHcpHierarchyApis(env: TestVars): Promise<{
  grandApi: Apis
  grandUser: User
  grandCredentials: UserCredentials
  parentApi: Apis
  parentUser: User
  parentCredentials: UserCredentials
  childApi: Apis
  childUser: User
  childCredentials: UserCredentials
  child2Api: Apis
  child2User: User
  child2Credentials: UserCredentials
}> {
  const initialisationApi = await TestSetupApi(env.iCureUrl, env.masterHcp!.user, env.masterHcp!.password, webcrypto as any, fetch, true, false)
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
  const grandApi = await Api(
    env.iCureUrl,
    grandCredentials.login,
    grandCredentials.password,
    webcrypto as any,
    fetch,
    false,
    false,
    grandStorage.storage,
    grandStorage.keyStorage,
    {
      entryKeysFactory: grandStorage.keyFactory,
      cryptoStrategies: new TestCryptoStrategies(),
    }
  )
  const parentStorage = await testStorageWithKeys([
    { dataOwnerId: grandCredentials.dataOwnerId, pairs: [{ privateKey: grandCredentials.privateKey, publicKey: grandCredentials.publicKey }] },
    { dataOwnerId: parentCredentials.dataOwnerId, pairs: [{ privateKey: parentCredentials.privateKey, publicKey: parentCredentials.publicKey }] },
  ])
  const parentApi = await Api(
    env.iCureUrl,
    parentCredentials.login,
    parentCredentials.password,
    webcrypto as any,
    fetch,
    false,
    false,
    parentStorage.storage,
    parentStorage.keyStorage,
    {
      entryKeysFactory: parentStorage.keyFactory,
      cryptoStrategies: new TestCryptoStrategies(),
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
  const childApi = await Api(
    env.iCureUrl,
    childCredentials.login,
    childCredentials.password,
    webcrypto as any,
    fetch,
    false,
    false,
    childStorage.storage,
    childStorage.keyStorage,
    {
      entryKeysFactory: childStorage.keyFactory,
      cryptoStrategies: new TestCryptoStrategies(),
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
  const child2Api = await Api(
    env.iCureUrl,
    child2Credentials.login,
    child2Credentials.password,
    webcrypto as any,
    fetch,
    false,
    false,
    child2Storage.storage,
    child2Storage.keyStorage,
    {
      entryKeysFactory: child2Storage.keyFactory,
      cryptoStrategies: new TestCryptoStrategies(),
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
