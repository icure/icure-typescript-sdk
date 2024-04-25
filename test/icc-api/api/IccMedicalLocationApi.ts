import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IccMedicallocationApi } from '../../../icc-api'
import { describe } from 'mocha'
import { MedicalLocation } from '../../../icc-api/model/MedicalLocation'

setLocalStorage(fetch)

let env: TestVars
let api: IccMedicallocationApi
const entities: MedicalLocation[] = []

describe('IccMedicalLocationApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = (await initMasterApi(env)).medicalLocationApi

    for (let i = 0; i < 10; i++) {
      const entity = await api.createMedicalLocation(
        new MedicalLocation({
          id: randomUUID(),
          name: randomUUID(),
        })
      )
      entities.push(entity)
    }
  })

  it('Should be able of getting the Medical Locations using the deprecated method', async () => {
    const page = await api.getMedicalLocations()
    entities.forEach((it) => {
      const existingEntity = page.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })

  it('Should be able of getting the Medical Locations with pagination', async () => {
    const firstPage = await api.getMedicalLocationsWithPagination(undefined, 6)
    expect(firstPage.nextKeyPair).not.to.be.undefined
    expect(firstPage.rows).not.to.be.undefined

    const secondPage = await api.getMedicalLocationsWithPagination(firstPage.nextKeyPair?.startKeyDocId, 10000)
    expect(secondPage.nextKeyPair).to.be.undefined
    expect(secondPage.rows).not.to.be.undefined

    const rows = firstPage.rows!!.concat(secondPage.rows!!)
    entities.forEach((it) => {
      const existingEntity = rows.find((a) => a.id === it.id)
      expect(existingEntity).not.to.be.undefined
      expect(it.rev).to.be.eq(existingEntity!!.rev!!)
    })
  })
})
