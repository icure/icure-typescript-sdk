import 'isomorphic-fetch'
import { expect } from 'chai'
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
    const mySecretIds = await cryptoApi.entities.secretIdsOf(me)
    const myEncryptionKeys = await cryptoApi.entities.encryptionKeysOf(me)
    expect(mySecretIds).to.have.length(1)
    expect(myEncryptionKeys).to.have.length(1)

    me = (await patientApi.modifyPatientWithUser(
      user,
      await cryptoApi.entities.entityWithExtendedEncryptedMetadata(me, hcpUser.healthcarePartyId!, mySecretIds, myEncryptionKeys, [], [])
    ))!
    await patientApi.modifyPatientWithUser(user, new Patient({ ...me, note: 'This is secret' }))

    const pat2 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    expect(pat2 != null)
    expect(pat2.note != null)
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
      await calendarItemApi.newInstancePatient(user, patient, { patientId: patient.id, title: ciTitle, details: ciDetails }, [])
    )

    const pat2 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    const ci2 = await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)
    expect(pat2).to.not.be.null
    expect(pat2.note).to.be.undefined
    expect(ci2).to.not.be.null
    expect(ci2.title).to.be.undefined
    expect(ci2.details).to.be.undefined

    await patientApi.modifyPatientWithUser(
      user,
      await cryptoApi.entities.entityWithExtendedEncryptedMetadata(
        pat!,
        hcpUser.healthcarePartyId!,
        await cryptoApi.entities.secretIdsOf(pat!),
        await cryptoApi.entities.encryptionKeysOf(pat!),
        [],
        []
      )
    )
    await calendarItemApi.modifyCalendarItemWithHcParty(
      user,
      await cryptoApi.entities.entityWithExtendedEncryptedMetadata(
        ci!,
        hcpUser.healthcarePartyId!,
        await cryptoApi.entities.secretIdsOf(ci),
        await cryptoApi.entities.encryptionKeysOf(ci),
        [],
        []
      )
    )
    await api.cryptoApi.forceReload(false)
    const pat3 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    const ci3 = await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)
    expect(pat3).to.not.be.null
    expect(pat3.note).to.equal(patNote)
    expect(ci3).to.not.be.null
    expect(ci3.title).to.equal(ciTitle)
    expect(ci3.details).to.equal(ciDetails)
  }).timeout(60000)
})
