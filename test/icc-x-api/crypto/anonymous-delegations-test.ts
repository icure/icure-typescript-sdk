import { expect } from 'chai'
import { before } from 'mocha'
import { createHcpHierarchyApis, getEnvironmentInitializer, getTempEmail, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { webcrypto } from 'crypto'
import 'isomorphic-fetch'
import { Apis } from '../../../icc-x-api'
import { User } from '../../../icc-api/model/User'
import { Patient } from '../../../icc-api/model/Patient'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { HealthcareParty } from '../../../icc-api/model/HealthcareParty'
import { v4 as uuid } from 'uuid'
import { TestApi } from '../../utils/TestApi'
import { CryptoPrimitives } from '../../../icc-x-api/crypto/CryptoPrimitives'
import { FilterChainMaintenanceTask } from '../../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTaskAfterDateFilter } from '../../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { KeyPairUpdateRequest } from '../../../icc-x-api/maintenance/KeyPairUpdateRequest'
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import { EntityWithDelegationTypeName } from '../../../icc-x-api/utils/EntityWithDelegationTypeName'
import { MaintenanceTask } from '../../../icc-api/model/MaintenanceTask'
import * as _ from 'lodash'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { SecureDelegation } from '../../../icc-api/model/SecureDelegation'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { DataOwnerTypeEnum } from '../../../icc-api/model/DataOwnerTypeEnum'
import initMasterApi = TestUtils.initMasterApi
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { Message } from '../../../icc-api/model/Message'
import { IccSecureDelegationKeyMapApi } from '../../../icc-api/api/internal/IccSecureDelegationKeyMapApi'

const FULL_WRITE = RequestedPermissionEnum.FULL_WRITE
const FULL_READ = RequestedPermissionEnum.FULL_READ

setLocalStorage(fetch)

type DataOwnerType = 'explicit' | 'anonymous'
type UserInfo = { user: User; pw: string; dataOwnerId: string }

const typeCombinations: [DataOwnerType, DataOwnerType][] = [
  ['explicit', 'explicit'],
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
    const timeBeforeNewKey = new Date().getTime()
    const newKeyPair = await primitives.RSA.generateKeyPair('sha-256')
    const newApi = await TestApi(env.iCureUrl, userThatLosesKey.user.login!, userThatLosesKey.pw, webcrypto as any, newKeyPair, {
      createMaintenanceTasksOnNewKey: false,
    })
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
              date: timeBeforeNewKey,
              healthcarePartyId: searchId,
            }),
          })
        )
        return [...awaitedAcc, ...currResult.rows!]
      }, Promise.resolve([] as MaintenanceTask[]))
      .then((tasks) => tasks.map((task) => KeyPairUpdateRequest.fromMaintenanceTask(task)))
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
    const updatedPatient1 = await masterApi.patientApi.shareWith(creatorInfo.dataOwnerId, patient, secretIds, { requestedPermissions: FULL_WRITE })
    await creatorApis.cryptoApi.forceReload()
    const updatedPatient2 = await creatorApis.patientApi.shareWith(delegateInfo.dataOwnerId, updatedPatient1, secretIds, {
      requestedPermissions: FULL_WRITE,
    })
    const healthElements: HealthElement[] = []
    for (let i = 0; i < 5; i++) {
      const he = await creatorApis.healthcareElementApi.createHealthElementWithUser(
        creatorInfo.user,
        await creatorApis.healthcareElementApi.newInstance(creatorInfo.user, updatedPatient2, { note: `Health element note - ${i}` })
      )
      const sharedHe = await creatorApis.healthcareElementApi.shareWith(delegateInfo.dataOwnerId, he, { requestedPermissions: FULL_WRITE })
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

  async function checkAccessInfo(
    actualAccessInfo: { permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean },
    expectedDataOwnersWithAccess: { [dataOwnerId: string]: AccessLevelEnum },
    expectedHasUnknownAnonymousDataOwners: boolean
  ) {
    expect(Object.keys(actualAccessInfo.permissionsByDataOwnerId)).to.have.members(Object.keys(expectedDataOwnersWithAccess))
    expect(actualAccessInfo.hasUnknownAnonymousDataOwners).to.equal(expectedHasUnknownAnonymousDataOwners)
    for (const [dataOwnerId, expectedLevel] of Object.entries(expectedDataOwnersWithAccess)) {
      expect(actualAccessInfo.permissionsByDataOwnerId[dataOwnerId]).to.equal(expectedLevel)
    }
  }

  it('without de-anonymisation metadata the data owners should be able to identify anonymous delegates only if they are part of the delegation with that delegate.', async () => {
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiP1 = await createUserAndApi('anonymous')
    const apiP2 = await createUserAndApi('anonymous')
    let entity: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    /*
     * A->A
     */
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      { [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE },
      false
    )
    entity = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    /*
     * A->A  A->B
     */
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    /*
     * A->A A->B
     *      A->P1
     */
    entity = await apiA.api.calendarItemApi.shareWith(apiP1.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await apiP1.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    /*
     * A->A  A->B  B->P1
     *       A->P1
     */
    entity = await apiB.api.calendarItemApi.shareWith(apiP1.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_READ })
    await apiP1.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      true
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    /*
     * A->A  A->B   B->P1
     *       A->P1  P1->P2
     */
    entity = await apiP1.api.calendarItemApi.shareWith(apiP2.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_READ })
    await apiP2.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      true
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      false
    )
    await checkAccessInfo(
      await apiP2.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.READ, // P2 is only aware of the P1->P2 delegation
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      true
    )
    /*
     * A->A  A->B   B->P1
     *       A->P1  P1->P2
     *       A->P2
     */
    entity = await apiA.api.calendarItemApi.shareWith(apiP2.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await apiP2.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      true
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.READ,
      },
      true
    )
    await checkAccessInfo(
      await apiP2.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.READ, // P2 is only aware of the P1->P2 delegation
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
  })

  it('without de-anonymisation metadata the data owners should be able to identify anonymous delegates only if their parent is part of the delegation with that delegate.', async () => {
    const { parentApi: childApi, parentUser: childUser, grandApi: parentApi, grandUser: parentUser } = await createHcpHierarchyApis(env) // Want to use only hcp with one parent
    const patientInfo = await createUserAndApi('anonymous')
    let entity: Message = await parentApi.messageApi.createMessage(
      await parentApi.messageApi.newInstanceWithPatient(parentUser, null, { subject: 'A simple subject' })
    )
    entity = await parentApi.messageApi.shareWith(patientInfo.userInfo.dataOwnerId, entity, [], { requestedPermissions: FULL_WRITE })
    await patientInfo.api.cryptoApi.forceReload()
    const expectedAccess = {
      // No child user: has no direct access, only access through parent delegation
      [parentUser.healthcarePartyId!]: AccessLevelEnum.WRITE,
      [patientInfo.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
    }
    await checkAccessInfo(await childApi.messageApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await parentApi.messageApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await patientInfo.api.messageApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
  })

  it('de-anonymisation metadata should allow data owners that are not part of a delegation to figure out the members of that delegation.', async () => {
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiP1 = await createUserAndApi('anonymous')
    const apiP2 = await createUserAndApi('anonymous')
    let entity: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    entity = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiA.api.calendarItemApi.shareWith(apiP1.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiB.api.calendarItemApi.shareWith(apiP1.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_READ })
    await apiP1.api.cryptoApi.forceReload()
    entity = await apiP1.api.calendarItemApi.shareWith(apiP2.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_READ })
    entity = await apiA.api.calendarItemApi.shareWith(apiP2.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    /*
     * A->A  A->B    B->?P1
     *       A->?P1  P1->?P2
     *       A->?P2
     */
    await apiA.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
      apiP1.userInfo.dataOwnerId,
      apiP2.userInfo.dataOwnerId,
    ])
    /*
     * A can create de-anonymization metadata for his delegations.
     * A->A  A->B    B->?P1
     *       A->P1  P1->?P2
     *       A->P2
     */
    await apiP1.api.cryptoApi.forceReload()
    await apiP2.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiP2.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
    await apiP1.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
      apiA.userInfo.dataOwnerId,
      apiP2.userInfo.dataOwnerId,
    ])
    /* Both delegator and delegate can create de-anonymization metadata for a delegation.
     * A->A  A->B   B->P1
     *       A->P1  P1->P2
     *       A->P2
     */
    await apiP1.api.cryptoApi.forceReload()
    await apiP2.api.cryptoApi.forceReload()
    await checkAccessInfo(
      await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiP1.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
    await checkAccessInfo(
      await apiP2.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP1.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiP2.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      false
    )
  })

  it('Hcp should be able to use de-anonymization metadata for parent', async () => {
    const hierarchy = await createHcpHierarchyApis(env)
    const patientInfo = await createUserAndApi('anonymous')
    let entity: CalendarItem = await hierarchy.parentApi.calendarItemApi.createCalendarItemWithHcParty(
      hierarchy.parentUser,
      await hierarchy.parentApi.calendarItemApi.newInstance(hierarchy.parentUser, { note: 'Calendar item note' })
    ) // Auto-shared with grandApi, but no de-anonymization metadata
    entity = await hierarchy.parentApi.calendarItemApi.shareWith(patientInfo.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await hierarchy.parentApi.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      hierarchy.grandUser.healthcarePartyId!,
    ])
    await patientInfo.api.cryptoApi.forceReload()
    const expectedAccess = {
      [hierarchy.parentUser.healthcarePartyId!]: AccessLevelEnum.WRITE,
      [hierarchy.grandUser.healthcarePartyId!]: AccessLevelEnum.WRITE,
      [patientInfo.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
    }
    await checkAccessInfo(await hierarchy.parentApi.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await hierarchy.grandApi.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await hierarchy.child2Api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await patientInfo.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
  })

  it('De-anonymization metadata should encrypt delegator and delegate, and its creation should be optimised', async () => {
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiP = await createUserAndApi('anonymous')
    let entity: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    entity = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiA.api.calendarItemApi.shareWith(apiP.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await apiA.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
      apiP.userInfo.dataOwnerId,
    ])
    const secureDelegationKeyMapApi = new IccSecureDelegationKeyMapApi(env.iCureUrl, {}, apiA.api.authApi.authenticationProvider, fetch)
    const secureDelegationKeyMaps = await secureDelegationKeyMapApi.getByDelegationKeys(
      { ids: Object.keys(entity.securityMetadata!.secureDelegations!) },
      []
    )
    expect(secureDelegationKeyMaps).to.have.length(1) // Only 1 is necessary -> only 1 is created
    expect(secureDelegationKeyMaps[0].delegator).to.be.undefined
    expect(secureDelegationKeyMaps[0].delegate).to.be.undefined
    const delegationKeyToPatient = Object.entries(entity.securityMetadata!.secureDelegations!).find(([_, v]) => v.delegate === undefined)![0]
    expect(delegationKeyToPatient).to.not.be.undefined
    expect(delegationKeyToPatient).to.not.be.empty
    expect(secureDelegationKeyMaps[0].delegationKey).to.equal(delegationKeyToPatient)
  })

  it('De-anonymization metadata should be usable for different entities of the same type', async () => {
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiP = await createUserAndApi('anonymous')
    let entity1: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    entity1 = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity1, { requestedPermissions: FULL_WRITE })
    entity1 = await apiA.api.calendarItemApi.shareWith(apiP.userInfo.dataOwnerId, entity1, { requestedPermissions: FULL_WRITE })
    let entity2: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    entity2 = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity2, { requestedPermissions: FULL_WRITE })
    entity2 = await apiA.api.calendarItemApi.shareWith(apiP.userInfo.dataOwnerId, entity2, { requestedPermissions: FULL_WRITE })
    await apiA.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity: entity1, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
    ])
    const expectedAccess = {
      [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiP.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
    }
    await apiP.api.cryptoApi.forceReload()
    await checkAccessInfo(await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity1), expectedAccess, false)
    await checkAccessInfo(await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity1), expectedAccess, false)
    await checkAccessInfo(await apiP.api.calendarItemApi.getDataOwnersWithAccessTo(entity1), expectedAccess, false)
    await checkAccessInfo(await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity2), expectedAccess, false)
    await checkAccessInfo(await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity2), expectedAccess, false)
    await checkAccessInfo(await apiP.api.calendarItemApi.getDataOwnersWithAccessTo(entity2), expectedAccess, false)
  })

  it('De-anonymization metadata optimization: the metadata should not be re-shared with the anonymous delegator/delegate by third parties', async () => {
    const apiP1 = await createUserAndApi('anonymous')
    const apiP2 = await createUserAndApi('anonymous')
    const apiA = await createUserAndApi('explicit')
    let entity: CalendarItem = await apiP1.api.calendarItemApi.createCalendarItemWithHcParty(
      apiP1.userInfo.user,
      await apiP1.api.calendarItemApi.newInstance(apiP1.userInfo.user, { note: 'Calendar item note' })
    )
    entity = await apiP1.api.calendarItemApi.shareWith(apiP2.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiP1.api.calendarItemApi.shareWith(apiA.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await apiP1.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiP2.userInfo.dataOwnerId,
      apiA.userInfo.dataOwnerId,
    ])
    const p1ToP2DelegationKey = Object.entries(entity.securityMetadata!.secureDelegations!).find(
      ([_, v]) => v.delegate === undefined && v.delegator === undefined && v.parentDelegations !== undefined
    )![0]
    expect(p1ToP2DelegationKey).to.not.be.undefined
    expect(p1ToP2DelegationKey).to.not.be.empty
    const delegationMapApi = new IccSecureDelegationKeyMapApi(env.iCureUrl, {}, apiA.api.authApi.authenticationProvider, fetch)
    const delegationMapBeforeAttemptedResharingByA = (await delegationMapApi.getByDelegationKeys({ ids: [p1ToP2DelegationKey] }, []))[0]
    expect(delegationMapBeforeAttemptedResharingByA).to.not.be.undefined
    expect(Object.keys(delegationMapBeforeAttemptedResharingByA.securityMetadata!.secureDelegations!)).to.have.length(3)
    await apiA.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiP2.userInfo.dataOwnerId,
      apiP1.userInfo.dataOwnerId,
    ])
    const delegationMapAfterAttemptedResharingByA = (await delegationMapApi.getByDelegationKeys({ ids: [p1ToP2DelegationKey] }, []))[0]
    expect(delegationMapAfterAttemptedResharingByA).to.not.be.undefined
    expect(Object.keys(delegationMapAfterAttemptedResharingByA.securityMetadata!.secureDelegations!)).to.have.length(3)
    expect(delegationMapAfterAttemptedResharingByA.rev).to.equal(delegationMapBeforeAttemptedResharingByA.rev)
  })

  it('De-anonymization metadata should be shared only with selected data owners', async () => {
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiC = await createUserAndApi('explicit')
    const apiP = await createUserAndApi('anonymous')
    let entity: CalendarItem = await apiA.api.calendarItemApi.createCalendarItemWithHcParty(
      apiA.userInfo.user,
      await apiA.api.calendarItemApi.newInstance(apiA.userInfo.user, { note: 'Calendar item note' })
    )
    entity = await apiA.api.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiA.api.calendarItemApi.shareWith(apiC.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await apiA.api.calendarItemApi.shareWith(apiP.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    await apiA.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
    ])
    const expectedAccess = {
      [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiC.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiP.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
    }
    await apiP.api.cryptoApi.forceReload()
    await checkAccessInfo(await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiP.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    // Except C does not know about P, because he was not given access to the relevant metadata.
    await checkAccessInfo(
      await apiC.api.calendarItemApi.getDataOwnersWithAccessTo(entity),
      {
        [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
        [apiC.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      },
      true
    )
  })

  it('A member of a delegation should be able to update the corresponding de-anonymization metadata even if he was not the original creator', async () => {
    const hierarchy = await createHcpHierarchyApis(env)
    const apiA = await createUserAndApi('explicit')
    const apiB = await createUserAndApi('explicit')
    const apiC = await createUserAndApi('explicit')
    const apiP = await createUserAndApi('anonymous')
    // Parent -> A, B, C, P
    let entity: CalendarItem = await hierarchy.grandApi.calendarItemApi.createCalendarItemWithHcParty(
      hierarchy.grandUser,
      await hierarchy.grandApi.calendarItemApi.newInstance(hierarchy.grandUser, { note: 'Calendar item note' })
    )
    entity = await hierarchy.grandApi.calendarItemApi.shareWith(apiA.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await hierarchy.grandApi.calendarItemApi.shareWith(apiB.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await hierarchy.grandApi.calendarItemApi.shareWith(apiC.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    entity = await hierarchy.grandApi.calendarItemApi.shareWith(apiP.userInfo.dataOwnerId, entity, { requestedPermissions: FULL_WRITE })
    // Child shares deanon info with A
    await hierarchy.parentApi.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiA.userInfo.dataOwnerId,
    ])
    // P shares with B
    await apiP.api.cryptoApi.forceReload()
    await apiP.api.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiB.userInfo.dataOwnerId,
    ])
    // Parent shares with C
    await hierarchy.grandApi.cryptoApi.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'CalendarItem' }, [
      apiC.userInfo.dataOwnerId,
    ])
    const expectedAccess = {
      [hierarchy.grandUser.healthcarePartyId!]: AccessLevelEnum.WRITE,
      [apiA.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiB.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiC.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
      [apiP.userInfo.dataOwnerId]: AccessLevelEnum.WRITE,
    }
    await checkAccessInfo(await hierarchy.grandApi.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await hierarchy.parentApi.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiA.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiB.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiC.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    await checkAccessInfo(await apiP.api.calendarItemApi.getDataOwnersWithAccessTo(entity), expectedAccess, false)
    const delegationKeyMapApi = new IccSecureDelegationKeyMapApi(env.iCureUrl, {}, hierarchy.grandApi.authApi.authenticationProvider, fetch)
    const delegationKeyToP = Object.entries(entity.securityMetadata!.secureDelegations!).find(([_, v]) => v.delegate === undefined)![0]
    expect(delegationKeyToP).to.not.be.undefined
    expect(delegationKeyToP).to.not.be.empty
    const delegationKeyMaps = await delegationKeyMapApi.getByDelegationKeys({ ids: Object.keys(entity.securityMetadata!.secureDelegations!) }, [])
    expect(delegationKeyMaps).to.have.length(1) // Only 1 anonymous, shared by everyone
  })

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
