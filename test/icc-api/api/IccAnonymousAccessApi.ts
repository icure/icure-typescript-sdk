import { randomUUID } from 'crypto'
import { describeNoLite, getEnvironmentInitializer, isLiteTest, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { MedicalLocation } from '../../../icc-api/model/MedicalLocation'

setLocalStorage(fetch)

let env: TestVars

describeNoLite('Anonymous Access', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be able to retrieve publicly available informations of medicalLocation', async () => {
    const { medicalLocationApi, anonymousAccessApi } = await initMasterApi(env)

    const createdMedicalLocation = await medicalLocationApi.createMedicalLocation(
      new MedicalLocation({
        id: randomUUID(),
        name: 'private medicalLocation ' + randomUUID(),
        description: 'private medicalLocation description ' + randomUUID(),
      })
    )

    const createdMedicalLocationWithPublicInfo = await medicalLocationApi.createMedicalLocation(
      new MedicalLocation({
        id: randomUUID(),
        name: 'public medicalLocation ' + randomUUID(),
        description: 'public medicalLocation description ' + randomUUID(),
        publicInformations: {
          address: 'public address',
          phone: '+32 2 555 55 55',
        },
      })
    )

    const groupId = getEnvVariables().testGroupId

    const paginatedMedicalLocations = await anonymousAccessApi.getPublicMedicalLocationsByGroupId(groupId)

    expect(paginatedMedicalLocations.rows?.length).to.be.greaterThan(0)

    const publicMedicalLocationIds = paginatedMedicalLocations.rows?.map((medicalLocation) => medicalLocation.id)
    expect(publicMedicalLocationIds).to.include(createdMedicalLocationWithPublicInfo.id)
    expect(publicMedicalLocationIds).not.to.include(createdMedicalLocation.id)

    const publicMedicalLocation: MedicalLocation = paginatedMedicalLocations.rows!.find(
      (medicalLocation) => medicalLocation.id === createdMedicalLocationWithPublicInfo.id
    )!
    expect(publicMedicalLocation).to.be.not.undefined
    expect(publicMedicalLocation?.name).to.be.undefined
    expect(publicMedicalLocation?.description).to.be.undefined
  })
})
