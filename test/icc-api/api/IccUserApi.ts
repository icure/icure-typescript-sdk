import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { describeNoLite, getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../../utils/test_utils'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { DatabaseInitialisation } from '../../../icc-api/model/DatabaseInitialisation'
import initMasterApi = TestUtils.initMasterApi

let env: TestVars
setLocalStorage(fetch)

describeNoLite('User in group', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be capable of creating a token', async () => {
    const { userApi } = await initApi(env, hcp1Username)
    const currentUser = await userApi.getCurrentUser()
    const token = await userApi.getTokenInGroup(currentUser.groupId!, currentUser.id!, `e2eTestTS-${randomUUID()}`, undefined, 3)
    expect(token.match(/[a-fA-F0-9]+/))
  }).timeout(30000)

  it('should be able to add and remove a role to a user', async () => {
    const { userApi, roleApi } = await initMasterApi(env)

    const role = (await roleApi.getRoles())[0].id!

    const login = `${randomUUID().substring(0, 6)}-test-user@icure.com`
    const user = await userApi.createUser({
      id: randomUUID(),
      name: randomUUID(),
      login: login,
      email: login,
    })
    expect(user.roles?.length ?? 0).to.be.equal(0)

    const userWithRole = await userApi.addRoles(user.id!, [role])
    expect(userWithRole.systemMetadata?.roles?.length ?? 0).to.be.equal(1)
    expect(userWithRole.systemMetadata?.inheritsRoles).to.be.equal(false)
    expect(userWithRole.systemMetadata?.roles![0]).to.be.equal(role)

    const userWithoutRole = await userApi.removeRoles(user.id!, [role])
    expect(userWithoutRole.systemMetadata?.inheritsRoles).to.be.equal(true)
  })

  it('should be able to add and remove a role to a user in group', async () => {
    const { userApi, roleApi, groupApi } = await initMasterApi(env)

    const role = (await roleApi.getRoles())[0].id!

    const groupId = randomUUID()
    const groupName = groupId.substring(0, 5)
    const groupPwd = randomUUID()
    await groupApi.createGroup(
      groupId,
      groupName,
      groupPwd,
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

    const login = `${randomUUID().substring(0, 6)}-test-user@icure.com`
    const user = await userApi.createUserInGroup(groupId, {
      id: randomUUID(),
      name: randomUUID(),
      login: login,
      email: login,
    })
    expect(user.roles?.length ?? 0).to.be.equal(0)

    const userWithRole = await userApi.addRolesInGroup(user.id!, groupId, [role])
    expect(userWithRole.systemMetadata?.roles?.length ?? 0).to.be.equal(1)
    expect(userWithRole.systemMetadata?.inheritsRoles).to.be.equal(false)
    expect(userWithRole.systemMetadata?.roles![0]).to.be.equal(role)

    const userWithoutRole = await userApi.removeRolesInGroup(user.id!, groupId, [role])
    expect(userWithoutRole.systemMetadata?.inheritsRoles).to.be.equal(true)
  })
})

describe('User', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('should be capable of creating a token', async () => {
    const { userApi } = await initApi(env, hcp1Username)
    const currentUser = await userApi.getCurrentUser()
    const token = await userApi.getToken(currentUser.id!, `e2eTestTS-${randomUUID()}`, 3, undefined)
    expect(token.match(/[a-fA-F0-9]+/))
  }).timeout(30000)
})
