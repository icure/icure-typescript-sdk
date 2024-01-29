import 'isomorphic-fetch'
import { Api as ApiV6, User as UserV6 } from '@icure/apiV6'
import { CryptoStrategies as CryptoStrategiesV7, DataOwnerWithType as DataOwnerWithTypeV7, IcureApi as ApiV7, User as UserV7 } from '@icure/apiV7'
import { EntityWithDelegationTypeName, hex2ua, IcureApi as ApiV8, RSAUtils, ShaVersion, ua2hex } from '../../icc-x-api'
import { getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { KeyPair } from '../../icc-x-api/crypto/RSA'
import { expect } from 'chai'
import { webcrypto } from 'crypto'
import { CryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { v4 as uuid } from 'uuid'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../utils/TestStorage'
import { TestCryptoStrategies } from '../utils/TestCryptoStrategies'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { hexPublicKeysWithSha1Of, hexPublicKeysWithSha256Of } from '../../icc-x-api/crypto/utils'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

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
  expect(actual.secretIds, `${actualName} - secret ids`).to.have.length(expected.secretIds.length)
  for (const expectedId of expected.secretIds) {
    expect(actual.secretIds, `${actualName} - secret id`).to.contain(expectedId)
  }
  expect(actual.owningEntityIds, `${actualName} - owning entity id`).to.have.length(expected.owningEntityIds.length)
  for (const expectedId of expected.owningEntityIds) {
    expect(actual.owningEntityIds, `${actualName} - owning entity id`).to.contain(expectedId)
  }
}

setLocalStorage(fetch)
const cryptoPrimitives = new CryptoPrimitives(webcrypto as any)
let env: TestVars

class ApiFactoryV6 implements ApiFactory {
  readonly version: string = 'apiV6.x'

  async masterApi(env: TestVars): Promise<UniformizedMasterApi> {
    const apis = await ApiV6(
      env.iCureUrl + '/rest/v1',
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
        const pair = await cryptoPrimitives.RSA.generateKeyPair(ShaVersion.Sha1)
        const hcp = await apis.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: `name`, lastName: 'v6' }))
        const user = await apis.userApi.createUser(
          new UserV6({
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
    const apis = await ApiV6(env.iCureUrl + '/rest/v1', credentials.login, credentials.password, webcrypto as any, fetch)
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
        const note = `v6 note ${uuid()}`
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

class TestCryptoStrategiesV7 implements CryptoStrategiesV7 {
  private readonly RSA = new RSAUtils(webcrypto as any)
  constructor(private readonly key: KeyPair<CryptoKey> | undefined) {}

  async generateNewKeyForDataOwner(self: DataOwnerWithTypeV7): Promise<KeyPair<CryptoKey> | boolean> {
    if (!this.key) return false
    const knownKeys = new Set(...hexPublicKeysWithSha1Of(self))
    if (knownKeys.size <= 0) return this.key
    return false
  }

  async recoverAndVerifySelfHierarchyKeys(
    keysData: {
      dataOwner: DataOwnerWithTypeV7
      unknownKeys: string[]
      unavailableKeys: string[]
    }[]
  ): Promise<{
    [p: string]: { recoveredKeys: { [p: string]: KeyPair<CryptoKey> }; keyAuthenticity: { [p: string]: boolean } }
  }> {
    const self = keysData[keysData.length - 1].dataOwner
    const knownKeys = new Set([...hexPublicKeysWithSha1Of(self.dataOwner), ...hexPublicKeysWithSha256Of(self.dataOwner)])
    const publicKey = this.key ? ua2hex(await this.RSA.exportKey(this.key.publicKey, 'spki')) : undefined
    return Object.fromEntries(
      await Promise.all(
        keysData.map(async (currData) => {
          if (currData.dataOwner.dataOwner.id! !== self.dataOwner.id!) {
            return [
              currData.dataOwner.dataOwner.id!,
              {
                recoveredKeys: {},
                keyAuthenticity: {},
              },
            ]
          } else if (publicKey === undefined || !knownKeys.has(publicKey)) {
            return [currData.dataOwner.dataOwner.id!, { recoveredKeys: {}, keyAuthenticity: {} }]
          } else {
            return [currData.dataOwner.dataOwner.id!, { recoveredKeys: { [publicKey.slice(-32)]: this.key }, keyAuthenticity: {} }]
          }
        })
      )
    )
  }

  verifyDelegatePublicKeys(delegate: any, publicKeys: string[]): Promise<string[]> {
    return Promise.resolve(publicKeys)
  }
}
class ApiFactoryV7 implements ApiFactory {
  readonly version: string = 'apiV7.x'

  async masterApi(env: TestVars): Promise<UniformizedMasterApi> {
    const key = {
      privateKey: await cryptoPrimitives.RSA.importKey('pkcs8', hex2ua(env.masterHcp!.privateKey), ['decrypt'], ShaVersion.Sha1),
      publicKey: await cryptoPrimitives.RSA.importKey('spki', hex2ua(env.masterHcp!.publicKey), ['encrypt'], ShaVersion.Sha1),
    }
    const apis = await ApiV7.initialise(
      env.iCureUrl,
      { username: env.masterHcp!.user, password: env.masterHcp!.password },
      new TestCryptoStrategiesV7(key),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    return <UniformizedMasterApi>{
      createUser: async () => {
        const pair = await cryptoPrimitives.RSA.generateKeyPair(ShaVersion.Sha1)
        const hcp = await apis.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: `name`, lastName: 'v7' }))
        const user = await apis.userApi.createUser(
          new UserV7({
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
            keyPair: {
              publicKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.publicKey, 'spki')),
              privateKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.privateKey, 'pkcs8')),
            },
            shaVersion: ShaVersion.Sha1,
          },
        ],
      },
    ])
    const apis = await ApiV7.initialise(
      env.iCureUrl,
      {
        username: credentials.login,
        password: credentials.password,
      },
      new TestCryptoStrategiesV7(credentials.key),
      webcrypto as any,
      fetch,
      {
        storage: testStorage.storage,
        keyStorage: testStorage.keyStorage,
        entryKeysFactory: testStorage.keyFactory,
      }
    )
    const user = await apis.userApi.getCurrentUser()
    return {
      userDetails: async () => {
        return { userId: user.id!, dataOwnerId: credentials.ownerId }
      },
      createEncryptedData: async () => {
        const note = `v7 note ${uuid}`
        const patient = await apis.patientApi.createPatientWithUser(user, await apis.patientApi.newInstance(user))
        const healthdata = await apis.healthcareElementApi.createHealthElementWithUser(
          user,
          await apis.healthcareElementApi.newInstance(user, patient, { note })
        )
        const secretIds = await apis.cryptoApi.entities.secretIdsOf(healthdata)
        expect(secretIds).to.have.length(1)
        return {
          id: healthdata.id,
          secretContent: note,
          secretIds,
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

class ApiFactoryV8 implements ApiFactory {
  readonly version: string = 'apiV8.x'

  async masterApi(env: TestVars): Promise<UniformizedMasterApi> {
    const key = {
      privateKey: await cryptoPrimitives.RSA.importKey('pkcs8', hex2ua(env.masterHcp!.privateKey), ['decrypt'], ShaVersion.Sha1),
      publicKey: await cryptoPrimitives.RSA.importKey('spki', hex2ua(env.masterHcp!.publicKey), ['encrypt'], ShaVersion.Sha1),
    }
    const apis = await ApiV8.initialise(
      env.iCureUrl,
      { username: env.masterHcp!.user, password: env.masterHcp!.password },
      new TestCryptoStrategies(key),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    return <UniformizedMasterApi>{
      createUser: async () => {
        const pair = await cryptoPrimitives.RSA.generateKeyPair(ShaVersion.Sha256)
        const hcp = await apis.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: `name`, lastName: 'v7' }))
        const user = await apis.userApi.createUser(
          new UserV7({
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
            keyPair: {
              publicKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.publicKey, 'spki')),
              privateKey: ua2hex(await cryptoPrimitives.RSA.exportKey(credentials.key.privateKey, 'pkcs8')),
            },
            shaVersion: ShaVersion.Sha1,
          },
        ],
      },
    ])
    const apis = await ApiV8.initialise(
      env.iCureUrl,
      {
        username: credentials.login,
        password: credentials.password,
      },
      new TestCryptoStrategies(credentials.key),
      webcrypto as any,
      fetch,
      {
        storage: testStorage.storage,
        keyStorage: testStorage.keyStorage,
        entryKeysFactory: testStorage.keyFactory,
      }
    )
    const user = await apis.userApi.getCurrentUser()
    return {
      userDetails: async () => {
        return { userId: user.id!, dataOwnerId: credentials.ownerId }
      },
      createEncryptedData: async () => {
        const note = `v8 note ${uuid()}`
        const patient = await apis.patientApi.createPatientWithUser(user, await apis.patientApi.newInstance(user))
        const healthdata = await apis.healthcareElementApi.createHealthElementWithUser(
          user,
          await apis.healthcareElementApi.newInstance(user, patient, { note })
        )
        return {
          id: healthdata.id,
          secretContent: note,
          secretIds: [],
          owningEntityIds: [patient.id! as string],
        }
      },
      getDecryptedData: async (id) => {
        const healthdata = await apis.healthcareElementApi.getHealthElementWithUser(user, id)
        return {
          secretContent: healthdata.note!,
          secretIds: await apis.cryptoApi.xapi.secretIdsOf({ entity: healthdata, type: EntityWithDelegationTypeName.HealthElement }, undefined),
          owningEntityIds: await apis.healthcareElementApi.decryptPatientIdOf(healthdata),
        }
      },
      shareEncryptedData: async (dataId, delegateId) => {
        const healthElement = await apis.healthcareElementApi.getHealthElementWithUser(user, dataId)
        await apis.healthcareElementApi.shareWith(delegateId, healthElement, { requestedPermissions: RequestedPermissionEnum.MAX_WRITE })
      },
    }
  }
}

// Api factories in chronological version order
let chronologicalApiFactories: ApiFactory[] = [new ApiFactoryV6(), new ApiFactoryV7(), new ApiFactoryV8()]

describe('All apis versions', async function () {
  before(async function () {
    this.timeout(600_000)
    env = await getEnvironmentInitializer().then((initializer) => initializer.execute(getEnvVariables()))
  })

  for (let legacyApiIndex = 0; legacyApiIndex < chronologicalApiFactories.length - 1; legacyApiIndex++) {
    const legacyApiFactory = chronologicalApiFactories[legacyApiIndex]
    const newApiFactories = chronologicalApiFactories.slice(legacyApiIndex + 1)
    it(`should be able to read and share data from older apis without affecting accessibility for older apis - ${legacyApiFactory.version}`, async function () {
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
