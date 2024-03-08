import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { describe } from 'mocha'
import { IccCalendarItemXApi } from '../../../icc-x-api'
import { CalendarItem } from '../../../icc-api/model/CalendarItem'
import { User } from '../../../icc-api/model/User'

setLocalStorage(fetch)

let env: TestVars
let api: IccCalendarItemXApi
let user: User
const entities: CalendarItem[] = []

describe('IccCalendarItemApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    const masterApi = await initMasterApi(env)
    user = await masterApi.userApi.getCurrentUser()
    api = masterApi.calendarItemApi

    for (let i = 0; i < 10; i++) {
      const entity = (await api.createCalendarItemWithHcParty(
        user,
        await api.newInstance(
          user,
          new CalendarItem({
            id: randomUUID(),
            name: randomUUID(),
          })
        )
      )) as CalendarItem
      entities.push(entity)
    }
  })

  it('Should be able of getting the CalendarItems using the deprecated method', async () => {
    const page = (await api.getCalendarItemsWithUser(user)) as CalendarItem[]
    page.forEach((it) => {
      const existingEntity = entities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the CalendarItems with pagination', async () => {
    const firstPage = await api.getCalendarItemsWithPaginationWithUser(user, undefined, 6)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await api.getCalendarItemsWithPaginationWithUser(user, firstPage.nextKeyPair?.startKeyDocId, 6)
    expect(secondPage.nextKeyPair).to.be.undefined
    expect(secondPage.rows).not.to.be.undefined

    const rows = firstPage.rows!!.concat(secondPage.rows!!)
    rows.forEach((it) => {
      const existingEntity = entities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })
})
