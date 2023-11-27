import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import {MedicalLocation} from "../../../icc-api/model/MedicalLocation"

setLocalStorage(fetch)

let env: TestVars

describe('Anonymous Access', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be able to retrieve publicly available informations of medicalLocation', async () => {
    const { medicalLocationApi, anonymousAccessApi } = await initMasterApi(env)

    const privateMedicalLocation = await medicalLocationApi.createMedicalLocation(
      new MedicalLocation({
        id: randomUUID(),
        name: 'private medicalLocation ' + randomUUID(),
        description: 'private medicalLocation description ' + randomUUID(),
      })
    )

    const publicMedicalLocation = await medicalLocationApi.createMedicalLocation(
      new MedicalLocation({
        id: randomUUID(),
        name: 'public medicalLocation ' + randomUUID(),
        description: 'public medicalLocation description ' + randomUUID(),
        publicInformations: {
          "address": "public address",
          "phone": "+32 2 555 55 55",
        },
      })
    )

    const groupId = getEnvVariables().testGroupId

    const paginatedMedicalLocations = await anonymousAccessApi.getPublicMedicalLocationsByGroupId(groupId)

    expect(paginatedMedicalLocations.rows?.length).to.be.equal(1)
    expect(paginatedMedicalLocations.rows?.[0].id).to.be.equal(publicMedicalLocation.id)
    expect(paginatedMedicalLocations.rows?.[0].name).to.be.undefined
    expect(paginatedMedicalLocations.rows?.[0].description).to.be.undefined
    expect(paginatedMedicalLocations.rows?.[0].publicInformations).not.to.be.undefined
    expect(paginatedMedicalLocations.rows?.[0].publicInformations?.address).to.be.equal(publicMedicalLocation.publicInformations?.address)
    expect(paginatedMedicalLocations.rows?.[0].publicInformations?.phone).to.be.equal(publicMedicalLocation.publicInformations?.phone)
  })
})
