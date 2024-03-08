import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccPlaceApi } from '../../../icc-api'
import { describe } from 'mocha'
import { Place } from '../../../icc-api/model/Place'

setLocalStorage(fetch)

let env: TestVars
let api: IccPlaceApi
const entities: Place[] = []

describe('IccArticleApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = (await initMasterApi(env)).placeApi

    for (let i = 0; i < 10; i++) {
      const entity = await api.createPlace(
        new Place({
          id: randomUUID(),
          name: randomUUID(),
        })
      )
      entities.push(entity)
    }
  })

  it('Should be able of getting the Places using the deprecated method', async () => {
    const page = await api.getPlaces()
    page.forEach((it) => {
      const existingEntity = entities.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the Place with pagination', async () => {
    const firstPage = await api.getPlacesWithPagination(undefined, 6)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await api.getPlacesWithPagination(firstPage.nextKeyPair?.startKeyDocId, 6)
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
