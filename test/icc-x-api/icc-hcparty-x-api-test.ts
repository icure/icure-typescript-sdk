import 'isomorphic-fetch'

import { before } from 'mocha'
import { getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import initApi = TestUtils.initApi
import { expect } from 'chai'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

describe('icc-hcparty-x-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('Does not cache entities that are not HCPs', async () => {
    // Given
    const { userApi: userApi, healthcarePartyApi: hcpApi } = await initApi(env, hcp1Username)

    const user = await userApi.getCurrentUser()

    let promiseResolves: boolean
    try {
      await hcpApi.getHealthcareParties({ ids: [user.id!, user.healthcarePartyId!] })
      promiseResolves = true
    } catch {
      promiseResolves = false
    }

    await hcpApi.getHealthcareParties({ ids: [user.id!, user.healthcarePartyId!] }).then(
      (_) => {
        throw new Error('This promise should not resolve')
      },
      (e) => {
        expect(JSON.parse(e.message)['message']).to.be.equal(
          `Object with ID ${user.id!} is not of expected type org.taktik.icure.entities.HealthcareParty but of type org.taktik.icure.entities.User`
        )
      }
    )
    expect(promiseResolves).to.be.false

    const hcp = await hcpApi.getHealthcareParty(user.healthcarePartyId!)
    expect(hcp.id).to.be.equal(user.healthcarePartyId!)

    await hcpApi.getHealthcareParty(user.id!).then(
      (_) => {
        throw new Error('This promise should not resolve')
      },
      (e) => {
        expect(JSON.parse(e.message)['message']).to.be.equal(
          `Object with ID ${user.id!} is not of expected type org.taktik.icure.entities.HealthcareParty but of type org.taktik.icure.entities.User`
        )
      }
    )
  })
})
