import { expect } from 'chai'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, getTempEmail, setLocalStorage, TestUtils, TestVars } from '../../utils/test_utils'
import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { Apis } from '../../../icc-x-api'
import { User } from '../../../icc-api/model/User'
import { Patient } from '../../../icc-api/model/Patient'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import initMasterApi = TestUtils.initMasterApi
import { HealthcareParty } from '../../../icc-api/model/HealthcareParty'
import { v4 as uuid } from 'uuid'
import { TestApi } from '../../utils/TestApi'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { FilterChainMaintenanceTask } from '../../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { DataOwnerTypeEnum } from '../../../icc-x-api/icc-data-owner-x-api'
import { EntityWithDelegationTypeName } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'
import { MaintenanceTask } from '../../../icc-api/model/MaintenanceTask'
import * as _ from 'lodash'

const FULL_WRITE = RequestedPermissionEnum.FULL_WRITE

setLocalStorage(fetch)

type DataOwnerType = 'explicit' | 'anonymous'
type UserInfo = { user: User; pw: string; dataOwnerId: string }

const typeCombinations: [DataOwnerType, DataOwnerType][] = [
  // ['explicit', 'explicit'],
  ['anonymous', 'explicit'],
  ['explicit', 'anonymous'],
  ['anonymous', 'anonymous'],
]
let env: TestVars
let masterApi: Apis
let masterUser: User
const primitives = new CryptoPrimitives(webcrypto as any)

describe('Anonymous delegations', () => {
  before(async function () {
    this.timeout(6000000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    masterApi = await initMasterApi(env)
    masterUser = await masterApi.userApi.getCurrentUser()
  })

  async function createUserAndApi(userType: DataOwnerType): Promise<{ api: Apis; userInfo: UserInfo }> {
    const dataOwner =
      userType === 'explicit'
        ? await masterApi.healthcarePartyApi.createHealthcareParty(new HealthcareParty({ id: uuid(), firstName: 'test', lastName: 'test' }))
        : await masterApi.patientApi.createPatientWithUser(
            masterUser,
            await masterApi.patientApi.newInstance(masterUser, new Patient({ id: uuid(), firstName: 'test', lastName: 'test' }))
          )
    const login = uuid()
    const user = await masterApi.userApi.createUser(
      new User({
        id: login,
        name: login,
        login: login,
        email: getTempEmail(),
        status: 'ACTIVE',
        healthcarePartyId: userType === 'explicit' ? dataOwner.id : undefined,
        patientId: userType === 'anonymous' ? dataOwner.id : undefined,
      })
    )
    const pw = await masterApi.userApi.getToken(user.id!, uuid())
    return {
      api: await TestApi(env.iCureUrl, login, pw, webcrypto as any),
      userInfo: { user, pw, dataOwnerId: dataOwner.id! },
    }
  }

  async function dataOwnerIdsForSearch(apis: Apis, dataOwnerId: string, entityType: EntityWithDelegationTypeName): Promise<string[]> {
    const delegationKeys = await apis.cryptoApi.exchangeData.getAllDelegationKeys(entityType)
    if (delegationKeys) {
      return delegationKeys
    } else {
      return [dataOwnerId]
    }
  }

  async function loseKeyAndGiveAccessBack(userThatLosesKey: UserInfo, apiToGiveAccessBack: Apis, userGivingAccessBack: UserInfo): Promise<Apis> {
    const newKeyPair = await primitives.RSA.generateKeyPair()
    const newApi = await TestApi(env.iCureUrl, userThatLosesKey.user.login!, userThatLosesKey.pw, webcrypto as any, newKeyPair)
    await newApi.icureMaintenanceTaskApi.createMaintenanceTasksForNewKeypair(userThatLosesKey.user, newKeyPair, [
      DataOwnerTypeEnum.Patient,
      DataOwnerTypeEnum.Hcp,
    ])
    await apiToGiveAccessBack.cryptoApi.forceReload()
    const searchIds = await dataOwnerIdsForSearch(apiToGiveAccessBack, userGivingAccessBack.dataOwnerId, 'MaintenanceTask')
    const keyPairUpdateRequests = await searchIds
      .reduce(async (acc, searchId) => {
        const awaitedAcc = await acc
        const currResult = await apiToGiveAccessBack.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
          userGivingAccessBack.user,
          undefined,
          undefined,
          new FilterChainMaintenanceTask({
            filter: new MaintenanceTaskAfterDateFilter({
              date: new Date().getTime() - 100000,
              healthcarePartyId: searchId,
            }),
          })
        )
        return [...awaitedAcc, ...currResult.rows!]
      }, Promise.resolve([] as MaintenanceTask[]))
      .then((tasks) => tasks.map((task) => new KeyPairUpdateRequest(task)))
    const concernedRequest = keyPairUpdateRequests.filter((x) => x.concernedDataOwnerId === userThatLosesKey.dataOwnerId)
    expect(concernedRequest).to.have.length(1)
    await apiToGiveAccessBack.icureMaintenanceTaskApi.applyKeyPairUpdate(concernedRequest[0])
    await newApi.cryptoApi.forceReload()
    return newApi
  }

  async function createAndShareData(
    creatorApis: Apis,
    creatorInfo: UserInfo,
    delegateInfo: UserInfo
  ): Promise<{ patient: Patient; healthElements: HealthElement[] }> {
    const patient = await masterApi.patientApi.createPatientWithUser(
      masterUser,
      await masterApi.patientApi.newInstance(masterUser, new Patient({ id: uuid(), firstName: 'test', lastName: 'test', note: 'Patient note' }))
    )
    const secretIds = await masterApi.patientApi.decryptSecretIdsOf(patient)
    const updatedPatient1 = (await masterApi.patientApi.shareWith(creatorInfo.dataOwnerId, patient, secretIds, { requestedPermissions: FULL_WRITE }))
      .updatedEntityOrThrow
    await creatorApis.cryptoApi.forceReload()
    const updatedPatient2 = (
      await creatorApis.patientApi.shareWith(delegateInfo.dataOwnerId, updatedPatient1, secretIds, { requestedPermissions: FULL_WRITE })
    ).updatedEntityOrThrow
    const healthElements: HealthElement[] = []
    for (let i = 0; i < 5; i++) {
      const he = await creatorApis.healthcareElementApi.createHealthElementWithUser(
        creatorInfo.user,
        await creatorApis.healthcareElementApi.newInstance(creatorInfo.user, updatedPatient2, { note: `Health element note - ${i}` })
      )
      const sharedHe = (await creatorApis.healthcareElementApi.shareWith(delegateInfo.dataOwnerId, he, { requestedPermissions: FULL_WRITE }))
        .updatedEntityOrThrow
      healthElements.push(sharedHe)
    }
    expect(updatedPatient2.note).to.not.be.undefined
    for (const he of healthElements) {
      expect(he.note).to.not.be.undefined
    }
    return { patient: updatedPatient2, healthElements }
  }

  async function checkCanFindAndDecrypt(apis: Apis, expected: { patient: Patient; healthElements: HealthElement[] }) {
    const user = await apis.userApi.getCurrentUser()
    const patient = await apis.patientApi.getPatientWithUser(user, expected.patient.id!)
    expect(patient.note).to.equal(expected.patient.note)
    const searchIds = await dataOwnerIdsForSearch(apis, apis.dataOwnerApi.getDataOwnerIdOf(user), 'HealthElement')
    const patientKeys = await apis.patientApi.decryptSecretIdsOf(patient)
    expect(patientKeys).to.not.be.empty
    const sfks = _.uniq(patientKeys).join(',')
    const retrievedHealthElements = _.uniqBy(
      await searchIds.reduce(async (acc, searchId) => {
        const awaitedAcc = await acc
        const currResult = await apis.healthcareElementApi.findByHCPartyPatientSecretFKeys(searchId, sfks)
        return [...awaitedAcc, ...currResult]
      }, Promise.resolve([] as HealthElement[])),
      (x) => x.id
    )
    expect(retrievedHealthElements.length).to.equal(expected.healthElements.length)
    for (const expectedHe of expected.healthElements) {
      const retrievedHe = retrievedHealthElements.find((x) => x.id === expectedHe.id)
      expect(retrievedHe).to.not.be.undefined
      expect(retrievedHe!.note).to.equal(expectedHe.note)
    }
  }

  typeCombinations.forEach(([delegatorType, delegateType]) => {
    it(`should allow delegate to find and decrypt an entity shared with him (${delegatorType}->${delegateType})`, async () => {
      const delegatorApi = await createUserAndApi(delegatorType)
      const delegateApi = await createUserAndApi(delegateType)
      const data = await createAndShareData(delegatorApi.api, delegatorApi.userInfo, delegateApi.userInfo)
      await delegateApi.api.cryptoApi.forceReload()
      await checkCanFindAndDecrypt(delegateApi.api, data)
      await checkCanFindAndDecrypt(delegatorApi.api, data)
    })

    it(`should allow delegator to find and decrypt an entity shared with others after give-access-back (${delegatorType}->${delegateType})`, async function () {
      if (delegatorType == delegateType || delegatorType != 'explicit') {
        const delegatorApi = await createUserAndApi(delegatorType)
        const delegateApi = await createUserAndApi(delegateType)
        const data = await createAndShareData(delegatorApi.api, delegatorApi.userInfo, delegateApi.userInfo)
        const delegatorApiAfterGiveAccessBack = await loseKeyAndGiveAccessBack(delegatorApi.userInfo, delegateApi.api, delegateApi.userInfo)
        await delegateApi.api.cryptoApi.forceReload()
        await checkCanFindAndDecrypt(delegateApi.api, data)
        await checkCanFindAndDecrypt(delegatorApi.api, data)
        await checkCanFindAndDecrypt(delegatorApiAfterGiveAccessBack, data)
      } else {
        console.warn('Currently not supported, will be in future')
      }
    })

    it(`should allow delegate to find and decrypt an entity shared with him after give-access-back (${delegatorType}->${delegateType})`, async function () {
      if (delegatorType == delegateType || delegateType != 'explicit') {
        const delegatorApi = await createUserAndApi(delegatorType)
        const delegateApi = await createUserAndApi(delegateType)
        const data = await createAndShareData(delegatorApi.api, delegatorApi.userInfo, delegateApi.userInfo)
        const delegateApiAfterGiveAccessBack = await loseKeyAndGiveAccessBack(delegateApi.userInfo, delegatorApi.api, delegatorApi.userInfo)
        await delegateApi.api.cryptoApi.forceReload()
        await checkCanFindAndDecrypt(delegateApi.api, data)
        await checkCanFindAndDecrypt(delegatorApi.api, data)
        await checkCanFindAndDecrypt(delegateApiAfterGiveAccessBack, data)
      } else {
        console.warn('Currently not supported, will be in future')
      }
    })
  })
})
