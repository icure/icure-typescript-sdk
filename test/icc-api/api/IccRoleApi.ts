import 'isomorphic-fetch'
import { describeNoLite, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { IccRoleApi } from '../../../icc-api/api/IccRoleApi'
import { expect } from 'chai'
import initMasterApi = TestUtils.initMasterApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)

let env: TestVars
let roleApi: IccRoleApi

describeNoLite('IccRoleApi', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    roleApi = (await initMasterApi(env)).roleApi
  })

  it('should be able of getting all the roles', async () => {
    const roles = await roleApi.getRoles()
    expect(roles.length).to.be.greaterThan(0)
  })
})
