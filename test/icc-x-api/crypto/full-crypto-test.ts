import { Api, Apis, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { Patient } from '../../../icc-api/model/Patient'
import { Contact } from '../../../icc-api/model/Contact'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { EncryptedEntity, FilterChainMaintenanceTask, HealthcareParty, Service, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { expect } from 'chai'
import { getEnvironmentInitializer, getTempEmail, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { TestApi } from '../../utils/TestApi'
import { KeyPair } from '../../../icc-x-api/crypto/RSA'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import initMasterApi = TestUtils.initMasterApi
import { SecureDelegation } from '../../../icc-api/model/SecureDelegation'
import AccessLevel = SecureDelegation.AccessLevelEnum
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { fingerprintV1 } from '../../../icc-x-api/crypto/utils'

setLocalStorage(fetch)

const FULL_WRITE = RequestedPermissionEnum.FULL_WRITE

type TestedEntity = 'Patient' | 'Contact' | 'HealthElement' | 'CalendarItem'

interface EntityFacade<T extends EncryptedEntity> {
  create: (api: Apis, record: Omit<T, 'rev'>) => Promise<T>
  get: (api: Apis, id: string) => Promise<T>
  share: (api: Apis, record: T, dataOwnerId: string) => Promise<T>
  isDecrypted: (entityToCheck: T) => Promise<boolean>
}

type EntityCreator<T> = (api: Apis, id: string, user: User, patient?: Patient, delegateIds?: string[]) => Promise<T>

interface EntityFacades {
  Patient: EntityFacade<Patient>
  Contact: EntityFacade<Contact>
  HealthElement: EntityFacade<HealthElement>
  CalendarItem: EntityFacade<CalendarItem>
}

interface EntityCreators {
  Patient: EntityCreator<Patient>
  Contact: EntityCreator<Contact>
  HealthElement: EntityCreator<HealthElement>
  CalendarItem: EntityCreator<CalendarItem>
}

const facades: EntityFacades = {
  Patient: {
    create: async (api, r) => api.patientApi.createPatientWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.patientApi.getPatientWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, r, doId) => {
      return await api.patientApi.shareWith(doId, r, await api.patientApi.decryptSecretIdsOf(r), { requestedPermissions: FULL_WRITE })
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.note != undefined
    },
  } as EntityFacade<Patient>,
  Contact: {
    create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, r, doId) => {
      return await api.contactApi.shareWith(doId, r, { requestedPermissions: FULL_WRITE })
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.services?.[0].content != undefined && Object.entries(entityToCheck.services?.[0].content).length > 0
    },
  } as EntityFacade<Contact>,
  HealthElement: {
    create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, r, doId) => {
      return await api.healthcareElementApi.shareWith(doId, r, { requestedPermissions: FULL_WRITE })
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.descr != undefined
    },
  } as EntityFacade<HealthElement>,
  CalendarItem: {
    create: async (api, r) => api.calendarItemApi.createCalendarItemWithHcParty(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.calendarItemApi.getCalendarItemWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, r, doId) => {
      return await api.calendarItemApi.shareWith(doId, r, { requestedPermissions: FULL_WRITE })
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.title != undefined
    },
  } as EntityFacade<CalendarItem>,
}

const users: { user: User; password: string }[] = []
const primitives = new CryptoPrimitives(webcrypto as any)
let delegateUser: User | undefined = undefined
let delegateHcp: HealthcareParty | undefined = undefined
let delegateHcpPassword: string | undefined = undefined

let userGivingAccessBack: User | undefined = undefined
let userGivingAccessBackPassword: string | undefined = undefined
let hcpGivingAccessBack: HealthcareParty | undefined = undefined

const entities: EntityCreators = {
  Patient: ({ patientApi }, id, user, _, delegateIds) => {
    return patientApi.newInstance(user, new Patient({ id, firstName: 'test', lastName: 'test', note: 'data', dateOfBirth: 20000101 }), {
      additionalDelegates: Object.fromEntries(delegateIds?.map((id) => [id, AccessLevel.WRITE]) ?? []),
    })
  },
  Contact: ({ contactApi }, id, user, patient, delegateIds) => {
    return contactApi.newInstance(
      user,
      patient!,
      new Contact({ id, services: [new Service({ label: 'svc', content: { fr: { stringValue: 'data' } } })] }),
      {
        additionalDelegates: Object.fromEntries(delegateIds?.map((id) => [id, AccessLevel.WRITE]) ?? []),
        confidential: false,
      }
    )
  },
  HealthElement: ({ healthcareElementApi }, id, user, patient, delegateIds) => {
    return healthcareElementApi.newInstance(user, patient!, new HealthElement({ id, descr: 'HE' }), {
      additionalDelegates: Object.fromEntries(delegateIds?.map((id) => [id, AccessLevel.WRITE]) ?? []),
      confidential: false,
    })
  },
  CalendarItem: ({ calendarItemApi }, id, user, patient, delegateIds) => {
    return calendarItemApi.newInstancePatient(user, patient!, new CalendarItem({ id, title: 'CI' }), {
      additionalDelegates: Object.fromEntries(delegateIds?.map((id) => [id, AccessLevel.WRITE]) ?? []),
    })
  },
}

const userDefinitions: Record<string, (user: User, password: string, pair: KeyPair<CryptoKey>) => Promise<{ user: User; apis: Apis }>> = {
  'one available key and one lost key recoverable through transfer keys': async (user, password, originalKey) => {
    const newKey = await primitives.RSA.generateKeyPair('sha-256')
    const apiWithOnlyNewKey = await Api(
      env!.iCureUrl,
      {
        username: user.login!,
        password,
      },
      new TestCryptoStrategies(newKey, {
        [fingerprintV1(ua2hex(await primitives.RSA.exportKey(originalKey.publicKey, 'spki')))]: true,
      }),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    const apis = await Api(
      env!.iCureUrl,
      {
        username: user.login!,
        password,
      },
      new TestCryptoStrategies(originalKey, {
        [fingerprintV1(ua2hex(await primitives.RSA.exportKey(newKey.publicKey, 'spki')))]: true,
      }),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    )
    expect(Object.keys(apis.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.length(2)
    await apiWithOnlyNewKey.cryptoApi.forceReload()
    expect(Object.keys(apiWithOnlyNewKey.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.length(2)
    return { user, apis: apiWithOnlyNewKey }
  },
  'two available keys': async (user, password, originalKey) => {
    const newKey = await primitives.RSA.generateKeyPair('sha-256')
    const apiWithOnlyNewKey = await Api(
      env!.iCureUrl,
      { username: user.login!, password },
      new TestCryptoStrategies(newKey),
      webcrypto as any,
      fetch,
      {
        storage: new TestStorage(),
        keyStorage: new TestKeyStorage(),
      }
    ) // Initializes the new key for the data owner
    const keyStrings = await Promise.all(
      [originalKey, newKey].map(async (pair) => ({
        publicKey: ua2hex(await primitives.RSA.exportKey(pair.publicKey, 'spki')),
        privateKey: ua2hex(await primitives.RSA.exportKey(pair.privateKey, 'pkcs8')),
      }))
    )
    const storage = await testStorageWithKeys([
      {
        dataOwnerId: user.healthcarePartyId ?? user.patientId!,
        pairs: keyStrings.map((key) => {
          return { keyPair: key, shaVersion: 'sha-256' }
        }),
      },
    ])
    const apis = await Api(env!.iCureUrl, { username: user.login!, password }, new TestCryptoStrategies(), webcrypto as any, fetch, {
      entryKeysFactory: storage.keyFactory,
      keyStorage: storage.keyStorage,
      storage: storage.storage,
    })
    return { user, apis }
  },
  'a single available key in old format': async (user, password, originalKey) => ({
    user,
    apis: await TestApi(env.iCureUrl, user.login!, password, webcrypto as any, originalKey),
  }),
  'one lost key and one available key': async (user, password) => {
    const newKeyPair = await primitives.RSA.generateKeyPair('sha-256')
    const apis = await TestApi(env.iCureUrl, user.login!, password, webcrypto as any, newKeyPair)
    await apis.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(user, newKeyPair)
    return { user, apis }
  },
  'one lost key and one upgraded available key thanks to delegate who gave access back to previous data': async (user, password) => {
    const newKeyPair = await primitives.RSA.generateKeyPair('sha-256')
    const api = await TestApi(env.iCureUrl, user.login!, password, webcrypto as any, newKeyPair)
    await api.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(user, newKeyPair)
    const giveAccessBackApi = apis['givingAccessBack']
    const keyPairUpdateRequests = (
      await giveAccessBackApi.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
        userGivingAccessBack!,
        undefined,
        undefined,
        new FilterChainMaintenanceTask({
          filter: new MaintenanceTaskAfterDateFilter({
            date: new Date().getTime() - 100000,
          }),
        })
      )
    ).rows!.map((x) => KeyPairUpdateRequest.fromMaintenanceTask(x))
    const concernedRequest = keyPairUpdateRequests.find((x) => x.concernedDataOwnerId === (user.healthcarePartyId ?? user.patientId))
    if (!concernedRequest) throw new Error('Could not find maintenance task')
    await giveAccessBackApi.icureMaintenanceTaskApi.applyKeyPairUpdate(concernedRequest)

    await api.cryptoApi.forceReload()

    return { user, apis: api }
  },
}

async function createPartialsForHcp(
  entityFacades: EntityFacades,
  entityCreators: EntityCreators,
  user: User,
  password: string
): Promise<KeyPair<CryptoKey>> {
  const key = await primitives.RSA.generateKeyPair('sha-256')
  const api1 = await TestApi(env!.iCureUrl, user.login!, password, webcrypto as any, key)
  await Object.entries(entityFacades).reduce(async (p, f) => {
    await p
    const type = f[0]
    const facade = f[1]
    const parent = type !== 'Patient' ? await api1.patientApi.getPatientWithUser(user, `partial-${user.id}-Patient`) : undefined
    const record = await entityCreators[type as TestedEntity](api1, `partial-${user.id}-${type}`, user, parent, [hcpGivingAccessBack!.id!])
    await facade.create(api1, record)
  }, Promise.resolve())
  return key
}

async function createPartialsForPatient(
  entityFacades: EntityFacades,
  entityCreators: EntityCreators,
  user: User,
  password: string,
  patientCreatorUser: User,
  patientCreatorApis: Apis
): Promise<KeyPair<CryptoKey>> {
  const key = await primitives.RSA.generateKeyPair('sha-256')
  const api1 = await TestApi(env!.iCureUrl, user.login!, password, webcrypto as any, key)
  const pat = await patientCreatorApis.patientApi.getPatientWithUser(patientCreatorUser, user.patientId!)
  await patientCreatorApis.patientApi.shareWith(user.patientId!, pat, await patientCreatorApis.patientApi.decryptSecretIdsOf(pat), {
    requestedPermissions: FULL_WRITE,
  })
  await Object.entries(entityFacades)
    .filter((it) => it[0] !== 'Patient')
    .reduce(async (p, f) => {
      await p
      const type = f[0]
      const facade = f[1]
      const parent = await api1.patientApi.getPatientWithUser(user, user.patientId!)
      const record = await entityCreators[type as TestedEntity](api1, `partial-${user.id}-${type}`, user, parent, [hcpGivingAccessBack!.id!])
      await facade.create(api1, record)
    }, Promise.resolve())
  return key
}

let env: TestVars
let apis: { [key: string]: Apis }

describe('Full crypto test - Creation scenarios', async function () {
  before(async function () {
    this.timeout(6000000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())

    const api = await initMasterApi(env!)
    const user = await api.userApi.getCurrentUser()
    const dataOwnerId = api.dataOwnerApi.getDataOwnerIdOf(user)

    const { userApi, patientApi, healthcarePartyApi, cryptoApi } = api

    delegateHcp = await healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: 'test', lastName: 'test' }))
    delegateUser = await userApi.createUser(
      new User({
        id: `user-${uuid()}-hcp`,
        login: `hcp-delegate-${uuid()}`,
        status: 'ACTIVE',
        healthcarePartyId: delegateHcp.id,
      })
    )
    delegateHcpPassword = await userApi.getToken(delegateUser!.id!, uuid())

    hcpGivingAccessBack = await healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: 'test', lastName: 'test' }))
    userGivingAccessBack = await userApi.createUser(
      new User({
        id: `user-${uuid()}-hcp`,
        login: `hcp-giving-access-back-${uuid()}`,
        status: 'ACTIVE',
        healthcarePartyId: hcpGivingAccessBack.id,
      })
    )
    userGivingAccessBackPassword = await userApi.getToken(userGivingAccessBack!.id!, uuid())

    apis = {
      delegate: await TestApi(env.iCureUrl!, delegateUser.login!, delegateHcpPassword, webcrypto as any),
      givingAccessBack: await TestApi(env.iCureUrl!, userGivingAccessBack.login!, userGivingAccessBackPassword, webcrypto as any),
    }

    await Object.entries(userDefinitions).reduce(async (p, [login, creationProcess]) => {
      await p
      const newPatientEmail = getTempEmail()
      const patientToCreate = await patientApi.newInstance(user, new Patient({ id: uuid(), firstName: 'test', lastName: 'test' }))
      const patient = await patientApi.createPatientWithUser(user, patientToCreate)

      const newHcpEmail = getTempEmail()
      const hcp = await healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: 'test', lastName: 'test' }))

      const newPatientUser = await userApi.createUser(
        new User({
          id: `user-${uuid()}-patient`,
          name: `patient-${login}`,
          login: newPatientEmail,
          email: newPatientEmail,
          status: 'ACTIVE',
          patientId: patient.id,
        })
      )
      const newPatientUserPassword = await userApi.getToken(newPatientUser!.id!, uuid())

      const newHcpUser = await userApi.createUser(
        new User({
          id: `user-${uuid()}-hcp`,
          login: newHcpEmail,
          email: newHcpEmail,
          name: `hcp-${login}`,
          status: 'ACTIVE',
          healthcarePartyId: hcp.id,
        })
      )
      const newHcpUserPassword = await userApi.getToken(newHcpUser!.id!, uuid())

      const originalKeyPat = await createPartialsForPatient(facades, entities, newPatientUser, newPatientUserPassword, user, api)
      const originalKeyHcp = await createPartialsForHcp(facades, entities, newHcpUser, newHcpUserPassword)

      const patDetails = await creationProcess(newPatientUser, newPatientUserPassword, originalKeyPat)
      const hcpDetails = await creationProcess(newHcpUser, newHcpUserPassword, originalKeyHcp)

      users.push({ user: patDetails.user, password: newPatientUserPassword })
      apis[patDetails.user.name!] = patDetails.apis
      users.push({ user: hcpDetails.user, password: newHcpUserPassword })
      apis[hcpDetails.user.name!] = hcpDetails.apis
    }, Promise.resolve())

    await users
      .filter((it) => it.user.id!.endsWith('patient'))
      .map((it) => it.user)
      .reduce(async (prev, it) => {
        await prev
        const otherUsers = users.filter((u) => u.user.id!.endsWith('patient') && u.user.id !== it.id).map((u) => u.user)

        await otherUsers.reduce(async (p, u) => {
          await p
          const patientToShare = await facades.Patient.get(api, it.patientId!)
          const sharedPatient = await facades.Patient.share(api, patientToShare, u.patientId!)
          return Promise.resolve()
        }, Promise.resolve())

        return Promise.resolve()
      }, Promise.resolve())
  })
  ;['patient', 'hcp'].forEach((uType) => {
    Object.keys(userDefinitions).forEach((uId) => {
      Object.entries(facades).forEach((f) => {
        it(`Create ${f[0]} as a ${uType} with ${uId}`, async function () {
          if (f[0] === 'Patient' && uType === 'patient') {
            this.skip()
          }
          const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
          const facade: EntityFacade<any> = f[1]
          const api = apis[`${uType}-${uId}`]

          const parent =
            f[0] !== 'Patient'
              ? uType === 'patient'
                ? await api.patientApi.getPatientWithUser(user, user.patientId!)
                : await api.patientApi.getPatientWithUser(user, `${user.id}-Patient`)
              : undefined
          const record = await entities[f[0] as TestedEntity](api, `${user.id}-${f[0]}`, user, parent)
          const entity = await facade.create(api, record)
          const retrieved = await facade.get(api, entity.id)

          expect(entity.id).to.be.not.null
          expect(entity.rev).to.equal(retrieved.rev)
          expect(await facade.isDecrypted(entity)).to.equal(true)
        })
        it(`Create ${f[0]} as delegate with delegation for ${uType} with ${uId}`, async function () {
          const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
          const facade: EntityFacade<any> = f[1]

          const api = apis['delegate']
          const patApi = apis[`${uType}-${uId}`]
          const dataOwnerId = api.dataOwnerApi.getDataOwnerIdOf(user)
          const dataOwner = (await patApi.dataOwnerApi.getCryptoActorStub(dataOwnerId))!.stub

          const parent = f[0] !== 'Patient' ? await api.patientApi.getPatientWithUser(delegateUser!, `delegate-${user.id}-Patient`) : undefined

          const record = await entities[f[0] as TestedEntity](api, `delegate-${user.id}-${f[0]}`, delegateUser!, parent, [
            (user.patientId ?? user.healthcarePartyId ?? user.deviceId)!,
          ])
          const entity = await facade.create(api, record)
          const retrieved = await facade.get(api, entity.id)
          expect(entity.id).to.be.not.null
          expect(entity.rev).to.equal(retrieved.rev)
          expect(await facade.isDecrypted(entity)).to.equal(true)
        })
      })
    })
  })
})

describe('Full crypto test - Read/Share scenarios', async function () {
  ;['patient', 'hcp'].forEach((uType) => {
    Object.keys(userDefinitions).forEach((uId) => {
      Object.entries(facades).forEach((f) => {
        it(`Read ${f[0]} as the initial ${uType} with ${uId}`, async function () {
          if (f[0] === 'Patient' && uType === 'patient') {
            this.skip()
          }
          const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
          const facade = f[1]
          const api = apis[`${uType}-${uId}`]

          const retrievePromise = facade.get(api, `partial-${user.id}-${f[0]}`)
          const lostInitialKey = uId.includes('one lost key and one available key')
          if (uType === 'patient' && lostInitialKey) {
            // Patient with lost key can't prove he has access to data: he will get an error
            let gaveError = false
            try {
              await retrievePromise
            } catch {
              gaveError = true
            }
            expect(gaveError).to.equal(true, 'Patient with lost key should not be able to retrieve data')
          } else {
            const entity = await retrievePromise
            expect(entity.id).to.equal(`partial-${user.id}-${f[0]}`)
            expect(await facade.isDecrypted(entity)).to.equal(!lostInitialKey) // data is accessible only with initial key for this test.
          }
        })
        it(`Read ${f[0]} as a ${uType} with ${uId}`, async function () {
          if (f[0] === 'Patient' && uType === 'patient') {
            this.skip()
          }
          const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
          const facade = f[1]
          const api = apis[`${uType}-${uId}`]

          const entity = await facade.get(api, `${user.id}-${f[0]}`)
          expect(entity.id).to.equal(`${user.id}-${f[0]}`)
          expect(await facade.isDecrypted(entity)).to.equal(true)
        })
        it(`Read ${f[0]} shared by delegate as a ${uType} with ${uId}`, async () => {
          const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
          const facade = f[1]
          const api = apis[`${uType}-${uId}`]
          await api.cryptoApi.forceReload()
          const entity = await facade.get(api, `delegate-${user.id}-${f[0]}`)
          expect(entity.id).to.equal(`delegate-${user.id}-${f[0]}`)
          expect(await facade.isDecrypted(entity)).to.equal(true)
        })
        ;['patient', 'hcp'].forEach((duType) => {
          Object.keys(userDefinitions).forEach((duId) => {
            it(`Share ${f[0]} as a ${uType} with ${uId} to a ${duType} with ${duId}`, async function () {
              if (f[0] === 'Patient' && uType === 'patient') {
                this.skip()
              }
              const { user } = users.find((it) => it.user.name === `${uType}-${uId}`)!
              const { user: delUser } = users.find((it) => it.user.name === `${duType}-${duId}`)!
              const delegateDoId = delUser.healthcarePartyId ?? delUser.patientId
              const facade = f[1]
              const api = apis[`${uType}-${uId}`]
              const delApi = apis[`${duType}-${duId}`]
              // Data was created (in a previous test) after lost key -> fully accessible
              const entity = await facade.share(api, await facade.get(api, `${user.id}-${f[0]}`), delegateDoId)
              const retrieved = await facade.get(api, entity.id)
              expect(entity.rev).to.equal(retrieved.rev)

              await delApi.cryptoApi.forceReload()
              const obj = await facade.get(delApi, `${user.id}-${f[0]}`)
              expect(await delApi.cryptoApi.xapi.hasWriteAccess({ entity: obj, type: f[0] as any })).to.equal(true)
              expect(await facade.isDecrypted(obj)).to.equal(true)
            })
          })
        })
      })
    })
  })
})
