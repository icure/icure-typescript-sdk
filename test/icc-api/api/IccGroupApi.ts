import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import 'isomorphic-fetch'
import { UserTypeEnum } from '../../../icc-api/model/UserTypeEnum'
import initMasterApi = TestUtils.initMasterApi
import { expect } from 'chai'
import { RoleSourceEnum } from '../../../icc-api/model/RoleSourceEnum'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { DatabaseInitialisation } from '../../../icc-api/model/DatabaseInitialisation'

setLocalStorage(fetch)

let env: TestVars

describe('Group', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be able to set and retrieve default roles in a group', async () => {
    const { roleApi, groupApi } = await initMasterApi(env)

    const role = (await roleApi.getRoles())[0].id!
    const userType = UserTypeEnum.Device

    const groupId = randomUUID()
    const groupName = groupId.substring(0, 5)
    await groupApi.createGroup(
      groupId,
      groupName,
      randomUUID(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new DatabaseInitialisation({
        users: [],
        healthcareParties: [],
      })
    )

    const updatedGroup = await groupApi.setDefaultRoles(groupId, userType, [role])
    expect(updatedGroup.defaultUserRoles).not.to.be.undefined
    expect(updatedGroup.defaultUserRoles!![userType][0]).to.be.equal(role)

    const retrievedRoles = await groupApi.getDefaultRoles(groupId)
    expect(retrievedRoles[userType].source).to.be.equal(RoleSourceEnum.Configuration)
    expect(retrievedRoles[userType].roles!![0]).to.be.equal(role)
    expect(retrievedRoles[UserTypeEnum.Hcp].source).to.be.equal(RoleSourceEnum.Inherited)
  })
})
