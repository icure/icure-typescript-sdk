import { Api, Apis, ua2hex } from '../../../icc-x-api'
import { v4 as uuid } from 'uuid'
import { Patient } from '../../../icc-api/model/Patient'
import { Contact } from '../../../icc-api/model/Contact'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { EncryptedEntity, EncryptedParentEntity, FilterChainMaintenanceTask, HealthcareParty, Service, User } from '../../../icc-api/model/models'
import { before, describe, it } from 'mocha'

import { webcrypto } from 'crypto'
import 'isomorphic-fetch'

import { expect } from 'chai'
import { getEnvironmentInitializer, getEnvVariables, getTempEmail, setLocalStorage, TestUtils, TestVars } from '../../utils/test_utils'
import { TestApi } from '../../utils/TestApi'
import { KeyPair } from '../../../icc-x-api/crypto/RSA'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { TestKeyStorage, TestStorage, testStorageWithKeys } from '../../utils/TestStorage'
import { DefaultStorageEntryKeysFactory } from '../../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import initMasterApi = TestUtils.initMasterApi

setLocalStorage(fetch)

type TestedEntity = 'Patient' | 'Contact' | 'HealthElement' | 'CalendarItem'

interface EntityFacade<T extends EncryptedEntity> {
  create: (api: Apis, record: Omit<T, 'rev'>) => Promise<T>
  get: (api: Apis, id: string) => Promise<T>
  share: (api: Apis, parent: EncryptedParentEntity | null, record: T, dataOwnerId: string) => Promise<T>
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
    share: async (api, p, r, doId) => {
      const user = await api.userApi.getCurrentUser()
      const ownerId = api.dataOwnerApi.getDataOwnerIdOf(user)
      return api.patientApi.modifyPatientWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.entities.entityWithExtendedEncryptedMetadata(
          r,
          doId,
          await api.cryptoApi.entities.secretIdsOf(r),
          await api.cryptoApi.entities.encryptionKeysOf(r),
          p ? [p.id!] : []
        )
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.note != undefined
    },
  } as EntityFacade<Patient>,
  Contact: {
    create: async (api, r) => api.contactApi.createContactWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.contactApi.getContactWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const user = await api.userApi.getCurrentUser()
      const ownerId = api.dataOwnerApi.getDataOwnerIdOf(user)
      return api.contactApi.modifyContactWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.entities.entityWithExtendedEncryptedMetadata(
          r,
          doId,
          await api.cryptoApi.entities.secretIdsOf(r),
          await api.cryptoApi.entities.encryptionKeysOf(r),
          p ? [p.id!] : []
        )
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.services?.[0].content != undefined && Object.entries(entityToCheck.services?.[0].content).length > 0
    },
  } as EntityFacade<Contact>,
  HealthElement: {
    create: async (api, r) => api.healthcareElementApi.createHealthElementWithUser(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.healthcareElementApi.getHealthElementWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const user = await api.userApi.getCurrentUser()
      const ownerId = api.dataOwnerApi.getDataOwnerIdOf(user)
      return api.healthcareElementApi.modifyHealthElementWithUser(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.entities.entityWithExtendedEncryptedMetadata(
          r,
          doId,
          await api.cryptoApi.entities.secretIdsOf(r),
          await api.cryptoApi.entities.encryptionKeysOf(r),
          p ? [p.id!] : []
        )
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.descr != undefined
    },
  } as EntityFacade<HealthElement>,
  CalendarItem: {
    create: async (api, r) => api.calendarItemApi.createCalendarItemWithHcParty(await api.userApi.getCurrentUser(), r),
    get: async (api, id) => api.calendarItemApi.getCalendarItemWithUser(await api.userApi.getCurrentUser(), id),
    share: async (api, p, r, doId) => {
      const user = await api.userApi.getCurrentUser()
      const ownerId = api.dataOwnerApi.getDataOwnerIdOf(user)
      return api.calendarItemApi.modifyCalendarItemWithHcParty(
        await api.userApi.getCurrentUser(),
        await api.cryptoApi.entities.entityWithExtendedEncryptedMetadata(
          r,
          doId,
          await api.cryptoApi.entities.secretIdsOf(r),
          await api.cryptoApi.entities.encryptionKeysOf(r),
          p ? [p.id!] : []
        )
      )
    },
    isDecrypted: async (entityToCheck) => {
      return entityToCheck.title != undefined
    },
  } as EntityFacade<CalendarItem>,
}
const patientFacades = Object.entries(facades)
  .filter((f) => f[0] !== 'Patient')
  .reduce((prev, curr) => ({ ...prev, [curr[0]]: curr[1] }), {})

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
    return patientApi.newInstance(user, new Patient({ id, firstName: 'test', lastName: 'test', note: 'data', dateOfBirth: 20000101 }), delegateIds)
  },
  Contact: ({ contactApi }, id, user, patient, delegateIds) => {
    return contactApi.newInstance(
      user,
      patient!,
      new Contact({ id, services: [new Service({ label: 'svc', content: { fr: { stringValue: 'data' } } })] }),
      false,
      delegateIds
    )
  },
  HealthElement: ({ healthcareElementApi }, id, user, patient, delegateIds) => {
    return healthcareElementApi.newInstance(user, patient!, new HealthElement({ id, descr: 'HE' }), false, delegateIds)
  },
  CalendarItem: ({ calendarItemApi }, id, user, patient, delegateIds) => {
    return calendarItemApi.newInstancePatient(user, patient!, new CalendarItem({ id, title: 'CI' }), delegateIds)
  },
}

const userDefinitions: Record<
  string,
  (user: User, password: string, pair: KeyPair<CryptoKey>) => Promise<{ user: User; apis: Apis; didLoseKey: boolean }>
> = {
  'one available key and one lost key recoverable through transfer keys': async (user, password, originalKey) => {
    const newKey = await primitives.RSA.generateKeyPair()
    const apiWithOnlyNewKey = await Api(
      env!.iCureUrl,
      user.login!,
      password,
      webcrypto as any,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      {
        cryptoStrategies: new TestCryptoStrategies(newKey, {
          [ua2hex(await primitives.RSA.exportKey(originalKey.publicKey, 'spki')).slice(-32)]: true,
        }),
      }
    )
    const apis = await Api(env!.iCureUrl, user.login!, password, webcrypto as any, fetch, false, false, new TestStorage(), new TestKeyStorage(), {
      cryptoStrategies: new TestCryptoStrategies(originalKey, {
        [ua2hex(await primitives.RSA.exportKey(newKey.publicKey, 'spki')).slice(-32)]: true,
      }),
    })
    expect(Object.keys(apis.cryptoApi.userKeysManager.getDecryptionKeys())).to.have.length(2)
    return { user, apis, didLoseKey: false }
  },
  'two available keys': async (user, password, originalKey) => {
    const newKey = await primitives.RSA.generateKeyPair()
    const apiWithOnlyNewKey = await Api(
      env!.iCureUrl,
      user.login!,
      password,
      webcrypto as any,
      fetch,
      false,
      false,
      new TestStorage(),
      new TestKeyStorage(),
      {
        cryptoStrategies: new TestCryptoStrategies(newKey),
      }
    )
    const keyStrings = await Promise.all(
      [originalKey, newKey].map(async (pair) => ({
        publicKey: ua2hex(await primitives.RSA.exportKey(pair.publicKey, 'spki')),
        privateKey: ua2hex(await primitives.RSA.exportKey(pair.privateKey, 'pkcs8')),
      }))
    )
    const storage = await testStorageWithKeys([{ dataOwnerId: user.healthcarePartyId ?? user.patientId!, pairs: keyStrings }])
    const apis = await Api(env!.iCureUrl, user.login!, password, webcrypto as any, fetch, false, false, storage.storage, storage.keyStorage, {
      entryKeysFactory: storage.keyFactory,
      cryptoStrategies: new TestCryptoStrategies(),
    })
    return { user, apis, didLoseKey: false }
  },
  'a single available key in old format': async (user, password, originalKey) => ({
    user,
    apis: await TestApi(env.iCureUrl, user.login!, password, webcrypto as any, originalKey),
    didLoseKey: false,
  }),
  'one lost key and one available key': async (user, password) => {
    const newKeyPair = await primitives.RSA.generateKeyPair()
    const apis = await TestApi(env.iCureUrl, user.login!, password, webcrypto as any, newKeyPair)
    await apis.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(user, newKeyPair)
    return { user, apis, didLoseKey: true }
  },
  'one lost key and one upgraded available key thanks to delegate who gave access back to previous data': async (user, password) => {
    const newKeyPair = await primitives.RSA.generateKeyPair()
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
    ).rows!.map((x) => new KeyPairUpdateRequest(x))
    const concernedRequest = keyPairUpdateRequests.find((x) => x.concernedDataOwnerId === (user.healthcarePartyId ?? user.patientId))
    if (!concernedRequest) throw new Error('Could not find maintenance task')
    await giveAccessBackApi.icureMaintenanceTaskApi.applyKeyPairUpdate(concernedRequest)

    await api.cryptoApi.forceReload(true)

    return { user, apis: api, didLoseKey: true }
  },
}

async function createPartialsForHcp(
  entityFacades: EntityFacades,
  entityCreators: EntityCreators,
  user: User,
  password: string
): Promise<KeyPair<CryptoKey>> {
  const key = await primitives.RSA.generateKeyPair()
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
  const key = await primitives.RSA.generateKeyPair()
  const api1 = await TestApi(env!.iCureUrl, user.login!, password, webcrypto as any, key)
  const pat = await patientCreatorApis.patientApi.getPatientWithUser(patientCreatorUser, user.patientId!)
  await patientCreatorApis.patientApi.modifyPatientWithUser(
    patientCreatorUser,
    await patientCreatorApis.cryptoApi.entities.entityWithExtendedEncryptedMetadata(
      pat,
      user.patientId!,
      await patientCreatorApis.cryptoApi.entities.secretIdsOf(pat),
      await patientCreatorApis.cryptoApi.entities.encryptionKeysOf(pat),
      []
    )
  )
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

      // Give access back to own sfks of patient
      if (patDetails.didLoseKey) {
        const keyPairUpdateRequests = (
          await api.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
            user,
            undefined,
            undefined,
            new FilterChainMaintenanceTask({
              filter: new MaintenanceTaskAfterDateFilter({
                date: new Date().getTime() - 100000,
              }),
            })
          )
        ).rows!.map((x) => new KeyPairUpdateRequest(x))
        const dataOwnerWithLostKey = newPatientUser.patientId!
        const concernedRequest = keyPairUpdateRequests.find((x) => x.concernedDataOwnerId === dataOwnerWithLostKey)
        if (!concernedRequest) throw new Error('Could not find maintenance task to regive access back to own sfks')
        await api.icureMaintenanceTaskApi.applyKeyPairUpdate(concernedRequest)
        await patDetails.apis.cryptoApi.forceReload(true)
      }
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
          const sharedPatient = await facades.Patient.share(api, null, patientToShare, u.patientId!)
          expect(Object.keys(sharedPatient.delegations ?? {})).to.contain(u.patientId!)
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
          const dataOwner = (await patApi.dataOwnerApi.getDataOwner(dataOwnerId))!.dataOwner

          const parent = f[0] !== 'Patient' ? await api.patientApi.getPatientWithUser(delegateUser!, `delegate-${user.id}-Patient`) : undefined

          const record = await entities[f[0] as TestedEntity](api, `delegate-${user.id}-${f[0]}`, delegateUser!, parent, [
            (user.patientId ?? user.healthcarePartyId ?? user.deviceId)!,
          ])
          const entity = await facade.create(api, record)
          const retrieved = await facade.get(api, entity.id)
          const hcp = await api.healthcarePartyApi.getCurrentHealthcareParty()

          const shareKeys = hcp.aesExchangeKeys![hcp.publicKey!][dataOwnerId]
          if (Object.keys(shareKeys).length > 2) {
            delete shareKeys[dataOwner.publicKey!.slice(-32)]
          }
          hcp.aesExchangeKeys = { ...hcp.aesExchangeKeys, [hcp.publicKey!]: { ...hcp.aesExchangeKeys![hcp.publicKey!], [dataOwnerId]: shareKeys } }
          await api.healthcarePartyApi.modifyHealthcareParty(hcp)

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

          const entity = await facade.get(api, `partial-${user.id}-${f[0]}`)
          expect(entity.id).to.equal(`partial-${user.id}-${f[0]}`)
          expect(await facade.isDecrypted(entity)).to.equal(
            !uId.includes('one lost key and one available key') /* data shared only with lost key... So false */
          )
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

              const parent =
                f[0] !== 'Patient'
                  ? uType === 'patient'
                    ? await api.patientApi.getPatientWithUser(user, user.patientId!)
                    : await api.patientApi.getPatientWithUser(user, `${user.id}-Patient`)
                  : undefined
              const entity = await facade.share(api, parent, await facade.get(api, `${user.id}-${f[0]}`), delegateDoId)
              const retrieved = await facade.get(api, entity.id)
              expect(entity.rev).to.equal(retrieved.rev)
              expect(Object.keys(entity.delegations)).to.contain(delegateDoId)

              const obj = await facade.get(delApi, `${user.id}-${f[0]}`)
              expect(Object.keys(obj.delegations)).to.contain(delegateDoId)
              expect(await facade.isDecrypted(obj)).to.equal(true)
            })
          })
        })
      })
    })
  })
})
