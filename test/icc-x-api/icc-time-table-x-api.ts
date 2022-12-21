import 'isomorphic-fetch'

import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import { IccTimeTableXApi } from '../../icc-x-api'
import initApi = TestUtils.initApi
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { TimeTable } from '../../icc-api/model/TimeTable'
import { Code } from '../../icc-api/model/Code'
import { TimeTableItem } from '../../icc-api/model/TimeTableItem'
import { TimeTableHour } from '../../icc-api/model/TimeTableHour'
import { expect } from 'chai'

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
    expect(baseTimeTable.encryptionKeys).to.be.undefined

    // When
    const createdTimeTable = await timeTableApiForHcp.createTimeTable(baseTimeTable)

    // Then
    expect(createdTimeTable.id).to.equals(baseTimeTable.id)
    expect(createdTimeTable.name).to.equals(baseTimeTable.name)
    expect(createdTimeTable.startTime).to.equals(baseTimeTable.startTime)
    expect(createdTimeTable.items!.length).to.equals(1)
  })
})
