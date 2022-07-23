import { before } from 'mocha'

import 'isomorphic-fetch'

import { LocalStorage } from 'node-localstorage'
import * as os from 'os'
import { Api, Apis } from '../../icc-x-api'
import { crypto } from '../../node-compat'
import { assert } from 'chai'
import { randomUUID } from 'crypto'
import { TestUtils } from '../utils/test_utils'
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
import initKey = TestUtils.initKey

const tmp = os.tmpdir()
console.log('Saving keys in ' + tmp)
;(global as any).localStorage = new LocalStorage(tmp, 5 * 1024 * 1024 * 1024)
;(global as any).Storage = ''

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcp1UserName = process.env.HCP_USERNAME!
const hcp1Password = process.env.HCP_PASSWORD!
const hcp1PrivKey = process.env.HCP_PRIV_KEY!

const hcp2UserName = process.env.HCP_2_USERNAME!
const hcp2Password = process.env.HCP_2_PASSWORD!
const hcp2PrivKey = process.env.HCP_2_PRIV_KEY!

let apiForHcp1: Apis
let hcp1User: User
let hcp1: HealthcareParty

let apiForHcp2: Apis
let hcp2User: User
let hcp2: HealthcareParty

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
    [delegatedTo.id!]
  )
}

before(async () => {
  console.info(`Starting tests using iCure URL : ${iCureUrl}`)

  if (hcp1UserName == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_USERNAME`)
  }

  if (hcp1Password == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PASSWORD`)
  }

  if (hcp1PrivKey == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_PRIV_KEY`)
  }

  if (hcp2UserName == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_USERNAME`)
  }

  if (hcp2Password == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_PASSWORD`)
  }

  if (hcp2PrivKey == undefined) {
    throw Error(`To run tests, you need to provide environment variable HCP_2_PRIV_KEY`)
  }

  // Init HCP1
  apiForHcp1 = await Api(iCureUrl, hcp1UserName, hcp1Password, crypto)
  hcp1User = await apiForHcp1.userApi.getCurrentUser()
  hcp1 = await apiForHcp1.healthcarePartyApi.getCurrentHealthcareParty()

  await initKey(apiForHcp1.userApi, apiForHcp1.cryptoApi, hcp1User, hcp1PrivKey)

  // Init HCP2
  apiForHcp2 = await Api(iCureUrl, hcp2UserName, hcp2Password, crypto)
  hcp2User = await apiForHcp2.userApi.getCurrentUser()
  hcp2 = await apiForHcp2.healthcarePartyApi.getCurrentHealthcareParty()
})

describe('icc-x-maintenance-task-api Tests', () => {
  it('CreateMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const taskToCreate = await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp2)

    // When
    const createdTask = await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(hcp1User, taskToCreate)

    // Then
    assert(createdTask != null)
    assert(createdTask.id == taskToCreate.id)
    assert(createdTask.delegations[hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.delegations[hcp2User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys[hcp1User.healthcarePartyId!] != undefined)
    assert(createdTask.encryptionKeys[hcp2User.healthcarePartyId!] != undefined)

    const foundTask: MaintenanceTask = await apiForHcp2.maintenanceTaskApi.getMaintenanceTaskWithUser(hcp2User, createdTask.id)

    assert(foundTask.id == createdTask.id)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.id) != undefined)
    assert(foundTask.properties?.find((prop: PropertyStub) => prop.typedValue?.stringValue == hcp2.publicKey) != undefined)
  })

  it('ModifyMaintenanceTaskWithUser Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    )
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

  it('FilterMaintenanceTaskByWithUser By Ids Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    )

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
    ).rows[0] as MaintenanceTask

    // Then
    assert(foundTask.id == createdTask.id)
  })

  it('FilterMaintenanceTaskByWithUser By Type Success for HCP', async () => {
    // Given
    const createdTask: MaintenanceTask = await apiForHcp1.maintenanceTaskApi.createMaintenanceTaskWithUser(
      hcp1User,
      await maintenanceTaskToCreate(apiForHcp1.maintenanceTaskApi, hcp1User, hcp1)
    )

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
    ).rows[0]

    // Then
    assert(foundTask.id == createdTask.id)
  })
})
