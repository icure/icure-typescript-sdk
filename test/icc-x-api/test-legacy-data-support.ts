import 'isomorphic-fetch'
import { Api as ApiV6 } from '@icure/apiV6'
import { Api as ApiV7, ua2hex, hex2ua } from '../../icc-x-api'
import { getEnvironmentInitializer, getEnvVariables, setLocalStorage, TestVars } from '../utils/test_utils'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { expect } from 'chai'
import { webcrypto } from 'crypto'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { User } from '../../icc-api/model/User'
import { v4 as uuid } from 'uuid'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../utils/TestStorage'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { DefaultStorageEntryKeysFactory } from '../../icc-x-api/storage/DefaultStorageEntryKeysFactory'

type UserCredentials = {
  login: string
  password: string
  ownerId: string
  key: KeyPair<CryptoKey>
}
type EncryptedData = {
  secretContent: string
  secretIds: string[]
  owningEntityIds: string[]
}

interface UniformizedMasterApi {
  createUser(): Promise<UserCredentials>
}

interface UniformizedTestApi {
  userDetails(): Promise<{ userId: string; dataOwnerId: string }>
  createEncryptedData(): Promise<{ id: string } & EncryptedData>
  getDecryptedData(id: string): Promise<EncryptedData>
  shareEncryptedData(dataId: string, delegateId: string): Promise<void>
}

interface ApiFactory {
  readonly version: string
  masterApi(env: TestVars): Promise<UniformizedMasterApi>
  testApi(credentials: UserCredentials): Promise<UniformizedTestApi>
}

function checkEncryptedData(actual: EncryptedData, expected: EncryptedData, actualName: string) {
  expect(actual.secretContent, `${actualName} - secret content`).to.equal(expected.secretContent)
  expect(actual.secretIds, `${actualName} - secret ids`).to.have.length(1)
  expect(actual.secretIds[0], `${actualName} - secret ids`).to.equal(expected.secretIds[0])
  expect(actual.owningEntityIds, `${actualName} - owning entity id`).to.have.length(1)
  expect(actual.owningEntityIds[0], `${actualName} - owning entity id`).to.equal(expected.owningEntityIds[0])
}

setLocalStorage(fetch)
const cryptoPrimitives = new CryptoPrimitives(webcrypto as any)
let env: TestVars

class ApiFactoryV6 implements ApiFactory {
  readonly version: string = 'apiV6.x'

  async masterApi(env: TestVars): Promise<UniformizedMasterApi> {
    const apis = await ApiV6(
      env.iCureUrl,
      env.masterHcp!.user,
      env.masterHcp!.password,
      webcrypto as any,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage()
    )
    return <UniformizedMasterApi>{
      createUser: async () => {
        const pair = await cryptoPrimitives.RSA.generateKeyPair()
        const hcp = await apis.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: `name`, lastName: 'v6' }))
        const user = await apis.userApi.createUser(
          new User({
            id: uuid(),
            login: `v6-${uuid()}`,
            status: 'ACTIVE',
            healthcarePartyId: hcp.id,
          })
        )
        return {
          login: user.login,
          password: await apis.userApi.getToken(user.id!, uuid()),
          key: pair,
          ownerId: hcp.id,
        }
      },
    }
  }

  async testApi(credentials: UserCredentials): Promise<UniformizedTestApi> {
    const apis = await ApiV6(env.iCureUrl, credentials.login, credentials.password, webcrypto as any, fetch)
    // await apis.cryptoApi.cacheKeyPair(await cryptoPrimitives.RSA.exportKeys(credentials.key, "jwk", "jwk"))
    const user = await apis.userApi.getCurrentUser()
    await apis.cryptoApi.addKeyPairForOwner(
      apis.maintenanceTaskApi,
      user,
      await apis.cryptoApi.getDataOwner(credentials.ownerId),
      credentials.key,
      false,
      false
    )
    return {
      userDetails: async () => {
        return { userId: user.id!, dataOwnerId: credentials.ownerId }
      },
      createEncryptedData: async () => {
        const note = `v6 note ${uuid}`
        const patient = await apis.patientApi.createPatientWithUser(user, await apis.patientApi.newInstance(user))
        const healthdata = await apis.healthcareElementApi.createHealthElementWithUser(
          user,
          await apis.healthcareElementApi.newInstance(user, patient, { note })
        )
        return {
          id: healthdata.id,
          secretContent: note,
          secretIds: (await apis.cryptoApi.extractDelegationsSFKs(healthdata, credentials.ownerId)).extractedKeys,
          owningEntityIds: [patient.id! as string],
        }
      },
      getDecryptedData: async (id) => {
        const healthdata = await apis.healthcareElementApi.getHealthElementWithUser(user, id)
        return {
          secretContent: healthdata.note!,
          secretIds: (await apis.cryptoApi.extractDelegationsSFKs(healthdata, credentials.ownerId)).extractedKeys,
          owningEntityIds: (await apis.cryptoApi.extractCryptedFKs(healthdata, credentials.ownerId)).extractedKeys,
        }
      },
      shareEncryptedData: async (dataId, delegateId) => {
        const healthElement = await apis.healthcareElementApi.getHealthElementWithUser(user, dataId)
        const patientIds = (await apis.cryptoApi.extractCryptedFKs(healthElement, credentials.ownerId)).extractedKeys
        expect(patientIds).to.have.length(1)
        const patient = await apis.patientApi.getPatientWithUser(user, patientIds[0])
        const secretIds = (await apis.cryptoApi.extractDelegationsSFKs(healthElement, credentials.ownerId)).extractedKeys
        expect(secretIds).to.have.length(1)
        await apis.healthcareElementApi.modifyHealthElementWithUser(
          user,
          (
            await apis.cryptoApi.extendedDelegationsAndCryptedForeignKeys(healthElement, patient, credentials.ownerId, delegateId, secretIds[0])
          ).modifiedObject
        )
      },
    }
  }
}

class ApiFactoryV7 implements ApiFactory {
  readonly version: string = 'apiV7.x'

  async masterApi(env: TestVars): Promise<UniformizedMasterApi> {
    const key = {
      privateKey: await cryptoPrimitives.RSA.importKey('pkcs8', hex2ua(env.masterHcp!.privateKey), ['decrypt']),
      publicKey: await cryptoPrimitives.RSA.importKey('spki', hex2ua(env.masterHcp!.publicKey), ['encrypt']),
    }
    const apis = await ApiV7(
      env.iCureUrl,
      env.masterHcp!.user,
      env.masterHcp!.password,
      webcrypto as any,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      new DefaultStorageEntryKeysFactory(),
      new TestCryptoStrategies(key)
    )
    return <UniformizedMasterApi>{
      createUser: async () => {
        const pair = await cryptoPrimitives.RSA.generateKeyPair()
        const hcp = await apis.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: `name`, lastName: 'v7' }))
        const user = await apis.userApi.createUser(
          new User({
            id: uuid(),
            login: `v7-${uuid()}`,
            status: 'ACTIVE',
            healthcarePartyId: hcp.id,
          })
        )
        return {
          login: user.login,
          password: await apis.userApi.getToken(user.id!, uuid()),
          key: pair,
          ownerId: hcp.id,
        }
      },
    }
  }

  async testApi(credentials: UserCredentials): Promise<UniformizedTestApi> {
    const testStorage = await testStorageWithKeys([
      {
        dataOwnerId: credentials.ownerId,
        pairs: [
          {
            publicKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.publicKey, 'spki')),
            privateKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.privateKey, 'pkcs8')),
          },
        ],
      },
    ])
    const apis = await ApiV7(
      env.iCureUrl,
      credentials.login,
      credentials.password,
      webcrypto as any,
      fetch,
      false,
      false,
      testStorage.storage,
      testStorage.keyStorage,
      testStorage.keyFactory,
      new TestCryptoStrategies(credentials.key)
    )
    const user = await apis.userApi.getCurrentUser()
    return {
      userDetails: async () => {
        return { userId: user.id!, dataOwnerId: credentials.ownerId }
      },
      createEncryptedData: async () => {
        const note = `v7 note ${uuid}`
        const secretId = uuid()
        const patient = await apis.patientApi.createPatientWithUser(user, await apis.patientApi.newInstance(user))
        const healthdata = await apis.healthcareElementApi.createHealthElementWithUser(
          user,
          await apis.healthcareElementApi.newInstance(user, patient, { note }, false, [], secretId)
        )
        return {
          id: healthdata.id,
          secretContent: note,
          secretIds: [secretId],
          owningEntityIds: [patient.id! as string],
        }
      },
      getDecryptedData: async (id) => {
        const healthdata = await apis.healthcareElementApi.getHealthElementWithUser(user, id)
        return {
          secretContent: healthdata.note!,
          secretIds: await apis.cryptoApi.entities.secretIdsOf(healthdata),
          owningEntityIds: await apis.cryptoApi.entities.owningEntityIdsOf(healthdata),
        }
      },
      shareEncryptedData: async (dataId, delegateId) => {
        const healthElement = await apis.healthcareElementApi.getHealthElementWithUser(user, dataId)
        const encryptionKeys = await apis.cryptoApi.entities.encryptionKeysOf(healthElement)
        const secretIds = await apis.cryptoApi.entities.secretIdsOf(healthElement)
        const owningEntityIds = await apis.cryptoApi.entities.owningEntityIdsOf(healthElement)
        await apis.healthcareElementApi.modifyHealthElementWithUser(
          user,
          await apis.cryptoApi.entities.entityWithExtendedEncryptedMetadata(healthElement, delegateId, secretIds, encryptionKeys, owningEntityIds, [])
        )
      },
    }
  }
}

// Api factories in chronological version order
let chronologicalApiFactories: ApiFactory[] = [new ApiFactoryV6(), new ApiFactoryV7()]

describe('All apis versions', async function () {
  before(async function () {
    this.timeout(600_000)
    env = await getEnvironmentInitializer().then((initializer) => initializer.execute(getEnvVariables()))
  })

  for (let legacyApiIndex = 0; legacyApiIndex < chronologicalApiFactories.length - 1; legacyApiIndex++) {
    const legacyApiFactory = chronologicalApiFactories[legacyApiIndex]
    const newApiFactories = chronologicalApiFactories.slice(legacyApiIndex + 1)
    it(`should be able to read data from older apis without affecting accessibility for older apis - ${legacyApiFactory.version}`, async function () {
      const legacyMasterApi = await legacyApiFactory.masterApi(env)
      const legacyUserCredentials = await legacyMasterApi.createUser()
      const legacyUserApi = await legacyApiFactory.testApi(legacyUserCredentials)
      const data = await legacyUserApi.createEncryptedData()
      checkEncryptedData(await legacyUserApi.getDecryptedData(data.id), data, 'Original decrypted data')
      const newApis = await Promise.all(
        newApiFactories.map(async (factory) => {
          const newLegacyUserApi = await factory.testApi(legacyUserCredentials)
          const newUser = await factory.masterApi(env).then((masterApi) => masterApi.createUser())
          const newUserApi = await factory.testApi(newUser)
          return { newLegacyUserApi, newUserApi, version: factory.version }
        })
      )
      for (const { newLegacyUserApi, newUserApi, version } of newApis) {
        checkEncryptedData(await newLegacyUserApi.getDecryptedData(data.id), data, `Data decrypted by legacy user on new api (${version})`)
        await newLegacyUserApi.shareEncryptedData(data.id, (await newUserApi.userDetails()).dataOwnerId)
        checkEncryptedData(await newUserApi.getDecryptedData(data.id), data, `Data decrypted by new user (${version})`)
      }
      checkEncryptedData(await legacyUserApi.getDecryptedData(data.id), data, `Data after changes by new versions of api`)
    })
  }
})
