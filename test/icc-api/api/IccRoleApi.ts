import { getEnvironmentInitializer, getEnvVariables, hcp1Username, TestVars } from '../../utils/test_utils'
import { Api } from '../../../icc-x-api'
import { crypto } from '../../../node-compat'
import { IccRoleApi } from '../../../icc-api/api/IccRoleApi'
import { expect } from 'chai'

let env: TestVars
let roleApi: IccRoleApi

describe('IccRoleApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    roleApi = (await Api(env.iCureUrl, env.masterHcp!!.user, env.masterHcp!!.password, crypto)).roleApi
  })

  it('should be able of getting all the roles', async () => {
    const roles = await roleApi.getRoles()
    expect(roles.length).to.be.greaterThan(0)
  })
})
