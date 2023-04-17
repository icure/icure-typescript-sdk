import 'isomorphic-fetch'
import { expect, use as chaiUse } from 'chai'
import 'mocha'
import { Apis } from '../../icc-x-api'
import { IccPatientApi } from '../../icc-api'
import { User } from '../../icc-api/model/User'
import { crypto } from '../../node-compat'
import { ua2hex } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, patUsername, setLocalStorage, TestUtils, TestVars } from '../utils/test_utils'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import initApi = TestUtils.initApi
import { TestApi } from '../utils/TestApi'
import { RSAUtils } from '../../icc-x-api/crypto/RSA'
import * as chaiAsPromised from 'chai-as-promised'
import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
chaiUse(chaiAsPromised)

setLocalStorage(fetch)
let env: TestVars
let api: Apis
let hcpUser: User

describe('Patient', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = await initApi(env, hcp1Username)
    hcpUser = await api.userApi.getCurrentUser()
  })

  it('should be capable of creating a patient from scratch', async () => {
    const rawPatientApiForHcp = new IccPatientApi(
      env.iCureUrl,
      {},
      new BasicAuthenticationProvider(env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
    )
    const patient = await rawPatientApiForHcp.createPatient(
      new Patient({ id: api.cryptoApi.primitives.randomUuid(), firstName: 'Tasty', lastName: 'Test' })
    )
    const pwd = api.cryptoApi.primitives.randomUuid()
    const tmpUser = await api.userApi.createUser(
      new User({
        id: api.cryptoApi.primitives.randomUuid(),
        login: api.cryptoApi.primitives.randomUuid(),
        passwordHash: pwd,
        patientId: patient.id,
      })
    )

    const rsa = new RSAUtils(crypto)
    const keyPair = await rsa.generateKeyPair()
    const { publicKey, privateKey } = keyPair
    const publicKeyHex = ua2hex(await rsa.exportKey(publicKey, 'spki'))
    const rawPatientApi = new IccPatientApi(env.iCureUrl, {}, new BasicAuthenticationProvider(tmpUser.id!, pwd))
    await rawPatientApi.modifyPatient(new Patient({ ...patient, publicKey: publicKeyHex }))

    // TODO some of these operations may be forbidden by the backend in future versions...
    const { userApi, patientApi, cryptoApi } = await TestApi(env.iCureUrl, tmpUser.id!, pwd!, crypto, keyPair)
    const user = await userApi.getCurrentUser()
    let me = await patientApi.getPatientWithUser(user, user.patientId!)
    me = (await cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(user.patientId!)).updatedDelegator?.dataOwner ?? me
    expect((await patientApi.getPatientWithUser(user, user.patientId!)).rev).to.equal(me.rev)
    me = (await cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(hcpUser.healthcarePartyId!)).updatedDelegator?.dataOwner ?? me
    expect((await patientApi.getPatientWithUser(user, user.patientId!)).rev).to.equal(me.rev)
    const mySecretIds = await patientApi.getSecretIdsOf(me)
    expect(mySecretIds).to.have.length(1)
    expect(await cryptoApi.xapi.encryptionKeysOf({ entity: me, type: 'Patient' }, undefined)).to.have.length(1)

    me = (await patientApi.shareWith(hcpUser.healthcarePartyId!, me, RequestedPermissionEnum.FULL_WRITE, mySecretIds)).updatedEntityOrThrow
    const expectedNote = 'This will be encrypted'
    await patientApi.modifyPatientWithUser(user, new Patient({ ...me, note: expectedNote }))

    const pat2 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    expect(!!pat2)
    expect(pat2.note).to.equal(expectedNote)
  }).timeout(60000)

  it('should be capable of logging in and encryption', async () => {
    const { userApi } = await initApi(env, patUsername)
    const rawPatientApi = new IccPatientApi(
      env.iCureUrl,
      {},
      new BasicAuthenticationProvider(env.dataOwnerDetails[patUsername].user, env.dataOwnerDetails[patUsername].password)
    )

    const user = await userApi.getCurrentUser()
    const patient = await rawPatientApi.getPatient(user.patientId!)

    const { calendarItemApi, patientApi, cryptoApi } = await initApi(env, patUsername)

    const patNote = 'Secret note'
    const pat = await patientApi.modifyPatientWithUser(user, {
      ...(await patientApi.getPatientWithUser(user, user.patientId!)),
      note: patNote,
    })
    const ciTitle = 'Secret title'
    const ciDetails = 'Important and private information'
    const ci = await calendarItemApi.createCalendarItemWithHcParty(
      user,
      await calendarItemApi.newInstancePatient(user, patient, { patientId: patient.id, title: ciTitle, details: ciDetails })
    )

    await expect(api.patientApi.getPatientWithUser(hcpUser, patient.id!)).to.be.rejected
    await expect(api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)).to.be.rejected

    await patientApi.shareWith(hcpUser.healthcarePartyId!, pat!, RequestedPermissionEnum.FULL_WRITE, await patientApi.getSecretIdsOf(pat!))
    await calendarItemApi.shareWith(hcpUser.healthcarePartyId!, ci!, RequestedPermissionEnum.FULL_WRITE)
    await api.cryptoApi.forceReload()
    const pat3 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    const ci3 = await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)
    expect(pat3).to.not.be.null
    expect(pat3.note).to.equal(patNote)
    expect(ci3).to.not.be.null
    expect(ci3.title).to.equal(ciTitle)
    expect(ci3.details).to.equal(ciDetails)
  }).timeout(60000)
})
