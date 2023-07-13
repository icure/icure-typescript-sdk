import 'isomorphic-fetch'

import { before } from 'mocha'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { IccTimeTableXApi } from '../../icc-x-api'
import initApi = TestUtils.initApi
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { TimeTable } from '../../icc-api/model/TimeTable'
import { Code } from '../../icc-api/model/Code'
import { TimeTableItem } from '../../icc-api/model/TimeTableItem'
import { TimeTableHour } from '../../icc-api/model/TimeTableHour'
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { PropertyStub } from '../../icc-api/model/PropertyStub'
import { PropertyTypeStub } from '../../icc-api/model/PropertyTypeStub'
import { TypedValueObject } from '../../icc-api/model/TypedValueObject'

setLocalStorage(fetch)
let env: TestVars

async function instanceTimeTableFor(timeTableApi: IccTimeTableXApi, user: User): Promise<TimeTable> {
  return timeTableApi.newInstance(
    user,
    new TimeTable({
      id: randomUUID(),
      tags: [
        new Code({
          id: 'ICURE|MY-CODE|1',
          code: 'MY-CODE',
          type: 'ICURE',
          version: '1',
        }),
      ],
      name: 'Main TimeTable',
      startTime: 20221101000,
      endTime: 20221128000,
      items: [
        new TimeTableItem({
          id: randomUUID(),
          rrule: 'RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=10',
          days: ['monday', 'tuesday', 'thursday'],
          hours: [
            new TimeTableHour({
              startHour: 1000,
              endHour: 1800,
            }),
          ],
        }),
      ],
    })
  )
}

describe('icc-x-time-table-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Create TimeTable Success', async () => {
    // Given
    const { userApi: userApiForHcp, timetableApi: timeTableApiForHcp } = await initApi(env, hcp1Username)

    const hcpUser = await userApiForHcp.getCurrentUser()

    const baseTimeTable = await instanceTimeTableFor(timeTableApiForHcp, hcpUser)
    expect(Object.keys(baseTimeTable.delegations!).length).to.equals(1)
    // TODO old test, now we want to always create encryption keys on all entities, right?
    // expect(baseTimeTable.encryptionKeys).to.be.undefined

    // When
    const createdTimeTable = await timeTableApiForHcp.createTimeTable(baseTimeTable)

    // Then
    expect(createdTimeTable.id).to.equals(baseTimeTable.id)
    expect(createdTimeTable.name).to.equals(baseTimeTable.name)
    expect(createdTimeTable.startTime).to.equals(baseTimeTable.startTime)
    expect(createdTimeTable.items!.length).to.equals(1)
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const entity = (await api1.timetableApi.createTimeTable(await api1.timetableApi.newInstance(user1, {})))!
    await api2.timetableApi
      .getTimeTable(entity.id!)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.timetableApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.timetableApi.getTimeTable(entity.id!)
    expect(retrieved.id).to.equal(entity.id)
  })

  it('newInstance should honor non-default values unless they are undefined', async () => {
    const api = await initApi(env!, hcp1Username)
    const user = await api.userApi.getCurrentUser()
    const timeTableUndefinedId = await api.timetableApi.newInstance(user, { id: undefined })
    const customId = 'customId'
    const timeTableCustomId = await api.timetableApi.newInstance(user, { id: customId })
    const timeTableWithUndefinedInit = await api.timetableApi.newInstance(user, undefined as any)
    expect(timeTableUndefinedId.id).to.not.be.undefined
    expect(timeTableWithUndefinedInit.id).to.not.be.undefined
    expect(timeTableCustomId.id).to.equal(customId)
  })
})
