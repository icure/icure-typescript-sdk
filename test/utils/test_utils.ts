import { User } from '../../icc-api/model/User'
import { Api, Apis, hex2ua, IccCryptoXApi, pkcs8ToJwk, spkiToJwk } from '../../icc-x-api'
import { IccDataOwnerXApi } from '../../icc-x-api/icc-data-owner-x-api'
import { AuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { AuthService } from '../../icc-x-api/auth/AuthService'
import { BasicAuthService } from '../../icc-x-api/auth/BasicAuthService'
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
    return Api(envVars.iCureUrl, envVars.dataOwnerDetails[userName].user, envVars.dataOwnerDetails[userName].password, crypto)
  }

  export async function initKey(dataOwnerApi: IccDataOwnerXApi, cryptoApi: IccCryptoXApi, user: User, privateKey: string) {
    const id = dataOwnerApi.getDataOwnerOf(user)!
    await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(id, hex2ua(privateKey)).catch((error: any) => {
      console.error('Error: in loadKeyPairsAsTextInBrowserLocalStorage')
      console.error(error)
    })
  }
}

export async function getApiAndAddPrivateKeysForUser(iCureUrl: string, details: UserDetails) {
  const api = await Api(iCureUrl, details.user, details.password, webcrypto as unknown as Crypto, fetch)
  const user = await api.userApi.getCurrentUser()
  const dataOwnerId = api.dataOwnerApi.getDataOwnerOf(user)
  const jwk = {
    publicKey: spkiToJwk(hex2ua(details.publicKey)),
    privateKey: pkcs8ToJwk(hex2ua(details.privateKey)),
  }
  await api.cryptoApi.cacheKeyPair(jwk)
  await api.cryptoApi.keyStorage.storeKeyPair(`${dataOwnerId}.${details.publicKey.slice(-32)}`, jwk)
  return api
}

export async function initKeys(api: Apis, userPrivKey: string, userPublicKey: string) {
  const currentUser = await api.userApi.getCurrentUser()
  const dataOwner = api.dataOwnerApi.getDataOwnerOf(currentUser)

  const jwk = {
    publicKey: spkiToJwk(hex2ua(userPublicKey)),
    privateKey: pkcs8ToJwk(hex2ua(userPrivKey)),
  }
  await api.cryptoApi.cacheKeyPair(jwk)
  await api.cryptoApi.keyStorage.storeKeyPair(`${dataOwner}.${userPublicKey.slice(-32)}`, jwk)
}
