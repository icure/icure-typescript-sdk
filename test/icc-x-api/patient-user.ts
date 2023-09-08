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
import { getEnvironmentInitializer, hcp1Username, patUsername, setLocalStorage, TestUtils } from '../utils/test_utils'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'
import initApi = TestUtils.initApi
import { TestApi } from '../utils/TestApi'
import { RSAUtils } from '../../icc-x-api/crypto/RSA'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

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
    await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })

    const { userApi, patientApi, cryptoApi } = await TestApi(env.iCureUrl, tmpUser.id!, pwd!, crypto, keyPair)
    const user = await userApi.getCurrentUser()
    let me: Patient = await patientApi.getPatientWithUser(user, user.patientId!)
    let updatedRev = me.rev
    updatedRev = (await cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(user.patientId!)).updatedDelegator?.stub.rev ?? updatedRev
    me = updatedRev == me.rev ? me : await patientApi.getPatientWithUser(user, user.patientId!)
    expect((await patientApi.getPatientWithUser(user, user.patientId!)).rev).to.equal(me.rev)
    updatedRev =
      (await cryptoApi.exchangeKeys.getOrCreateEncryptionExchangeKeysTo(hcpUser.healthcarePartyId!)).updatedDelegator?.stub.rev ?? updatedRev
    me = updatedRev == me.rev ? me : await patientApi.getPatientWithUser(user, user.patientId!)
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
    const { userApi, calendarItemApi, patientApi } = await initApi(env, patUsername)

    const user = await userApi.getCurrentUser()

    const patNote = 'Secret note'
    const retrievedPat = await patientApi.getPatientWithUser(user, user.patientId!)
    const pat = await patientApi.modifyPatientWithUser(user, {
      ...retrievedPat,
      note: patNote,
    })
    expect(pat!.note).to.equal(patNote)
    const ciTitle = 'Secret title'
    const ciDetails = 'Important and private information'
    const ci = await calendarItemApi.createCalendarItemWithHcParty(
      user,
      await calendarItemApi.newInstancePatient(user, pat, { patientId: pat!.id, title: ciTitle, details: ciDetails })
    )

    let failed = false
    try {
      await api.patientApi.getPatientWithUser(hcpUser, pat!.id!)
    } catch {
      failed = true
    }
    expect(failed).to.be.true
    failed = false
    try {
      await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)
    } catch {
      failed = true
    }
    expect(failed).to.be.true

    await patientApi.shareWith(hcpUser.healthcarePartyId!, pat!, await patientApi.decryptSecretIdsOf(pat!))
    await calendarItemApi.shareWith(hcpUser.healthcarePartyId!, ci!)
    await api.cryptoApi.forceReload()
    const pat3 = await api.patientApi.getPatientWithUser(hcpUser, pat!.id!)
    const ci3 = await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)
    expect(pat3).to.not.be.null
    expect(pat3.note).to.equal(patNote)
    expect(ci3).to.not.be.null
    expect(ci3.title).to.equal(ciTitle)
    expect(ci3.details).to.equal(ciDetails)
  }).timeout(60000)
})
