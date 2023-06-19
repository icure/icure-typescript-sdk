import 'isomorphic-fetch'
import { getEnvironmentInitializer, hcp1Username, hcp2Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { before } from 'mocha'
import { EncryptedFieldsConfig, IccAccesslogXApi, IccPatientXApi, IccUserXApi } from '../../icc-x-api'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import { IccAccesslogApi } from '../../icc-api'
import { Patient } from '../../icc-api/model/Patient'
import { User } from '../../icc-api/model/User'
import { randomUUID } from 'crypto'
import { AccessLog } from '../../icc-api/model/AccessLog'
import { assert, expect } from 'chai'
import initApi = TestUtils.initApi
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

describe('icc-x-accesslog-api Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  async function createPatient(patientApiForHcp: IccPatientXApi, hcpUser: User) {
    return patientApiForHcp.createPatientWithUser(
      hcpUser,
      await patientApiForHcp.newInstance(
        hcpUser,
        new Patient({
          id: randomUUID(),
          firstName: 'John',
          lastName: 'Snow',
          note: 'Winter is coming',
        })
      )
    )
  }

  it('Test', async () => {
    // Given
    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)

    const userApi = new IccUserXApi(env.iCureUrl, {}, authProvider, fetch)
    const accessLogApi = new IccAccesslogApi(env.iCureUrl, {}, authProvider, fetch)

    const currentUser = await userApi.getCurrentUser()

    await accessLogApi.findByUserAfterDate(currentUser.id!)
  })

  it('Test findBy', async () => {
    // Given
    const {
      userApi: userApiForHcp,
      dataOwnerApi: dataOwnerApiForHcp,
      patientApi: patientApiForHcp,
      cryptoApi: cryptoApiForHcp,
      dataOwnerApi: dateOwnerApiForHcp,
    } = await initApi(env!, hcp1Username)
    const hcpUser = await userApiForHcp.getCurrentUser()

    const username = env.dataOwnerDetails[hcp1Username].user
    const password = env.dataOwnerDetails[hcp1Username].password

    const authProvider = new BasicAuthenticationProvider(username, password)

    const accessLogXApi = new IccAccesslogXApi(
      env.iCureUrl,
      {},
      cryptoApiForHcp,
      dateOwnerApiForHcp,
      EncryptedFieldsConfig.Defaults.accessLog,
      authProvider,
      fetch
    )

    const patient = (await createPatient(patientApiForHcp, hcpUser)) as Patient

    const accessLog = new AccessLog({
      id: randomUUID(),
      _type: 'org.taktik.icure.entities.AccessLog',
      created: new Date().getTime(),
      modified: new Date().getTime(),
      date: +new Date(),
      responsible: hcpUser.healthcarePartyId!,
      author: hcpUser.id,
      codes: [],
      tags: [],
      user: hcpUser.id,
      patient: patient.id,
      accessType: 'USER_ACCESS',
    })

    const accessLogToCreate = await accessLogXApi.newInstance(hcpUser, patient, accessLog)
    const createdAccessLog = await accessLogXApi.createAccessLogWithUser(hcpUser, accessLogToCreate)

    const foundItems: AccessLog[] = await accessLogXApi.findBy(hcpUser.healthcarePartyId!, patient, false)
    const foundItemsUsingPost: AccessLog[] = await accessLogXApi.findBy(hcpUser.healthcarePartyId!, patient, true)

    assert(foundItems.length == 1, 'Found items should be 1')
    assert(foundItems[0].id == createdAccessLog.id, 'Found item should be the same as the created one')

    assert(foundItemsUsingPost.length == 1, 'Found items using post should be 1')
    assert(foundItemsUsingPost[0].id == createdAccessLog.id, 'Found item using post should be the same as the created one')
  })

  it('Share with should work as expected', async () => {
    const api1 = await initApi(env!, hcp1Username)
    const user1 = await api1.userApi.getCurrentUser()
    const api2 = await initApi(env!, hcp2Username)
    const user2 = await api2.userApi.getCurrentUser()
    const samplePatient = await api1.patientApi.createPatientWithUser(
      user1,
      await api1.patientApi.newInstance(user1, { firstName: 'Gigio', lastName: 'Bagigio' })
    )
    const encryptedField = 'Something encrypted'
    const entity = await api1.accessLogApi.createAccessLogWithUser(
      user1,
      await api1.accessLogApi.newInstance(user1, samplePatient, { detail: encryptedField })
    )
    expect(entity.detail).to.be.equal(encryptedField)
    await api2.accessLogApi
      .getAccessLogWithUser(user2, entity.id)
      .then(() => {
        throw new Error('Should not be able to get the entity')
      })
      .catch(() => {
        /* expected */
      })
    await api1.accessLogApi.shareWith(user2.healthcarePartyId!, entity)
    const retrieved = await api2.accessLogApi.getAccessLogWithUser(user2, entity.id)
    expect(retrieved.detail).to.be.equal(encryptedField)
    expect((await api2.accessLogApi.decryptPatientIdOf(retrieved))[0]).to.equal(samplePatient.id)
  })
})
