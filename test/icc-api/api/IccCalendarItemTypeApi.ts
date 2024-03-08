import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccCalendarItemTypeApi } from '../../../icc-api'
import { describe } from 'mocha'
import { CalendarItemType } from '../../../icc-api/model/CalendarItemType'

setLocalStorage(fetch)

let env: TestVars
let api: IccCalendarItemTypeApi
const entities: CalendarItemType[] = []
const deletedEntities: CalendarItemType[] = []

describe('IccCalendarItemType', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = (await initMasterApi(env)).calendarItemTypeApi

    for (let i = 0; i < 10; i++) {
      const entity = await api.createCalendarItemType(
        new CalendarItemType({
          id: randomUUID(),
          name: randomUUID(),
        })
      )
      entities.push(entity)
      const deletedEntity = await api.createCalendarItemType(
        new CalendarItemType({
          id: randomUUID(),
          deletionDate: new Date().getTime(),
          name: randomUUID(),
        })
      )
      deletedEntities.push(deletedEntity)
    }
  })

  it('Should be able of getting the CalendarItemTypes using the deprecated method', async () => {
    const page = await api.getCalendarItemTypes()
    page.forEach((it) => {
      const existingEntity = entities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the CalendarItemTypes with pagination', async () => {
    const firstPage = await api.getCalendarItemTypesWithPagination(undefined, 6)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await api.getCalendarItemTypesWithPagination(firstPage.nextKeyPair?.startKeyDocId, 6)
    expect(secondPage.nextKeyPair).to.be.undefined
    expect(secondPage.rows).not.to.be.undefined

    const rows = firstPage.rows!!.concat(secondPage.rows!!)
    rows.forEach((it) => {
      const existingEntity = entities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the CalendarItemTypes including deleted using the deprecated method', async () => {
    const page = await api.getCalendarItemTypesIncludeDeleted()
    const allEntities = entities.concat(deletedEntities)
    page.forEach((it) => {
      const existingEntity = allEntities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the CalendarItemTypes including delete with pagination', async () => {
    const firstPage = await api.getCalendarItemTypesIncludeDeletedWithPagination(undefined, undefined, 11)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await api.getCalendarItemTypesIncludeDeletedWithPagination(
      firstPage.nextKeyPair?.startKey,
      firstPage.nextKeyPair?.startKeyDocId,
      11
    )
    expect(secondPage.nextKeyPair).to.be.undefined
    expect(secondPage.rows).not.to.be.undefined

    const rows = firstPage.rows!!.concat(secondPage.rows!!)
    const allEntities = entities.concat(deletedEntities)
    rows.forEach((it) => {
      const existingEntity = allEntities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })
})
