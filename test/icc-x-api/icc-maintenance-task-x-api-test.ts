import { before } from 'mocha'

import 'isomorphic-fetch'

import { Apis } from '../../icc-x-api'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { User } from '../../icc-api/model/User'
import { IccMaintenanceTaskXApi } from '../../icc-x-api/icc-maintenance-task-x-api'
import { MaintenanceTask } from '../../icc-api/model/MaintenanceTask'
import { PropertyStub } from '../../icc-api/model/PropertyStub'
import { PropertyTypeStub } from '../../icc-api/model/PropertyTypeStub'
import { TypedValueObject } from '../../icc-api/model/TypedValueObject'
import { HealthcareParty } from '../../icc-api/model/HealthcareParty'
import { Identifier } from '../../icc-api/model/Identifier'
import { FilterChainMaintenanceTask } from '../../icc-api/model/FilterChainMaintenanceTask'
import { MaintenanceTaskByIdsFilter } from '../../icc-x-api/filters/MaintenanceTaskByIdsFilter'
import { MaintenanceTaskByHcPartyAndTypeFilter } from '../../icc-x-api/filters/MaintenanceTaskByHcPartyAndTypeFilter'
import { DocIdentifier } from '../../icc-api/model/DocIdentifier'
import initApi = TestUtils.initApi
import { MaintenanceTaskAfterDateFilter } from '../../icc-x-api/filters/MaintenanceTaskAfterDateFilter'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

function maintenanceTaskToCreate(mTaskApiForHcp: IccMaintenanceTaskXApi, hcpUser: User, delegatedTo: HealthcareParty) {
  return mTaskApiForHcp.newInstance(
    hcpUser,
    new MaintenanceTask({
      id: randomUUID(),
      taskType: randomUUID(),
      status: MaintenanceTask.StatusEnum.Pending,
      properties: [
        new PropertyStub({
          id: 'dataOwnerConcernedId',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: delegatedTo.id,
          }),
        }),
        new PropertyStub({
          id: 'dataOwnerConcernedPubKey',
          type: new PropertyTypeStub({ type: PropertyTypeStub.TypeEnum.STRING }),
          typedValue: new TypedValueObject({
            type: TypedValueObject.TypeEnum.STRING,
            stringValue: delegatedTo.publicKey,
          }),
        }),
      ],
    }),
    { additionalDelegates: { [delegatedTo.id!]: 'WRITE' } }
  )
}

let apiForHcp1: Apis
let hcp1User: User
let hcp1: HealthcareParty

let apiForHcp2: Apis
let hcp2User: User
let hcp2: HealthcareParty

describe('icc-x-maintenance-task-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())

    apiForHcp1 = await initApi(env, hcp1Username)
    hcp1User = await apiForHcp1.userApi.getCurrentUser()
    hcp1 = await apiForHcp1.healthcarePartyApi.getCurrentHealthcareParty()

    apiForHcp2 = await initApi(env, hcp2Username)
    hcp2User = await apiForHcp2.userApi.getCurrentUser()
    hcp2 = await apiForHcp2.healthcarePartyApi.getCurrentHealthcareParty()
  })

  it('CreateMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const taskToCreate = await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp2)

    // When
    const createdTask = await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(hcp1User, taskToCreate)

    // Then
    assert(createdTask != null)
    assert(createdTask.id == taskToCreate.id)
    assert(createdTask.delegations![hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.delegations![hcp2User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys![hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys![hcp2User.healthcarePartyId!] != undefined)

    const foundTask: MaintenanceTask = await apiForHcp2.maintenanceTaskApi.getMaintenanceTaskWithUser(hcp2User, createdTask.id!)

    assert(foundTask.id == createdTask.id)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.id) != undefined)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.publicKey) != undefined)
  }).timeout(30000)

  it('ModifyMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!
    const identifierToAdd = new Identifier({ id: 'SYSTEM-TEST|VALUE-TEST', system: 'SYSTEM-TEST', value: 'VALUE-TEST' })

    // When
    const updatedTask: MaintenanceTask = await apiForHcp1.maintenanceTaskApi.modifyMaintenanceTaskWithUser(
      hcp1User,
      new MaintenanceTask({ ...createdTask, identifier: [identifierToAdd], status: MaintenanceTask.StatusEnum.Ongoing })
    )

    // Then
    assert(updatedTask.id == createdTask.id)
    assert(updatedTask.identifier?.[0].system == identifierToAdd.system)
    assert(updatedTask.identifier?.[0].value == identifierToAdd.value)
    assert(updatedTask.identifier?.[0].id == identifierToAdd.id)
    assert(updatedTask.status == MaintenanceTask.StatusEnum.Ongoing)
  })

  it('DeleteMaintenanceTaskWithUser Success for delegated HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!
    assert(!!createdTask.id)

    // When
    const deletedTask: DocIdentifier[] = await apiForHcp1.maintenanceTaskApi.deleteMaintenanceTaskWithUser(hcp1User, createdTask.id!)

    // Then
    assert(!!deletedTask)
    assert(deletedTask.length == 1)
    assert(deletedTask[0].id === createdTask.id)
  })

  it('DeleteMaintenanceTaskWithUser Success for HCP that which parent has delegation', async () => {
    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!
    assert(!!createdTask.id)

    // When
    const deletedTask: DocIdentifier[] = await apiForHcp2.maintenanceTaskApi.deleteMaintenanceTaskWithUser(hcp1User, createdTask.id!)

    // Then
    assert(!!deletedTask)
    assert(deletedTask.length == 1)
    assert(deletedTask[0].id === createdTask.id)
  })

  it('DeleteMaintenanceTaskWithUser Fails for non-delegated HCP', async () => {
    const apiForHcp3 = await initApi(env, hcp2Username)
    const hcp3User = await apiForHcp3.userApi.getCurrentUser()

    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!
    assert(!!createdTask.id)

    // When
    apiForHcp3.maintenanceTaskApi.deleteMaintenanceTaskWithUser(hcp3User, createdTask.id!).then(
      () => {
        throw new Error('You should not be here')
      },
      (e) => {
        assert(!!e)
      }
    )

    // Then
    const actualTask: MaintenanceTask = await apiForHcp1.maintenanceTaskApi.getMaintenanceTaskWithUser(hcp1User, createdTask.id!)
    assert(!!actualTask)
    assert(!actualTask.deletionDate)
  })

  it('FilterMaintenanceTaskByWithUser By Ids Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!

    // When
    const foundTask = (
      await apiForHcp1.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
        hcp1User,
        undefined,
        undefined,
        new FilterChainMaintenanceTask({
          filter: new MaintenanceTaskByIdsFilter({
            ids: [createdTask.id!],
          }),
        })
      )
    ).rows![0] as MaintenanceTask

    // Then
    assert(foundTask.id == createdTask.id)
  })

  it('FilterMaintenanceTaskByWithUser By Type Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    ))!

    // When
    const foundTask = (
      await apiForHcp1.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
        hcp1User,
        undefined,
        undefined,
        new FilterChainMaintenanceTask({
          filter: new MaintenanceTaskByHcPartyAndTypeFilter({
            healthcarePartyId: hcp1.id!,
            type: createdTask.taskType!,
          }),
        })
      )
    ).rows![0]

    // Then
    assert(foundTask.id == createdTask.id)
  })

  it('FilterMaintenanceTaskByWithUser After Date Success for HCP', async () => {
    // Given
    const startTimestamp = new Date().getTime() + 1000
    const taskToCreate = { ...(await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)), created: startTimestamp }

    const createdTask: MaintenanceTask = (await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(hcp1User, taskToCreate))!

    // When
    const foundTask = (
      await apiForHcp1.maintenanceTaskApi.filterMaintenanceTasksByWithUser(
        hcp1User,
        undefined,
        undefined,
        new FilterChainMaintenanceTask({
          filter: new MaintenanceTaskAfterDateFilter({
            healthcarePartyId: hcp1.id!,
            date: startTimestamp - 1000,
          }),
        })
      )
    ).rows![0]

    // Then
    assert(foundTask.id == createdTask.id)
  })
})
