import { expect } from 'chai'
import 'mocha'
import { Api, Apis, pkcs8ToJwk } from '../../icc-x-api'
import { IccPatientApi } from '../../icc-api'
import { User } from '../../icc-api/model/User'
import { crypto } from '../../node-compat'
import { ua2hex, hex2ua } from '../../icc-x-api'
import { Patient } from '../../icc-api/model/Patient'
import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, patUsername, setLocalStorage, TestVars } from '../utils/test_utils'
import { BasicAuthenticationProvider } from '../../icc-x-api/auth/AuthenticationProvider'

setLocalStorage(fetch)
let env: TestVars
let api: Apis
let hcpUser: User

describe('Patient', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    api = await Api(env.iCureUrl, env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password, crypto)
    hcpUser = await api.userApi.getCurrentUser()
    await api.cryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(
      hcpUser.healthcarePartyId!,
      pkcs8ToJwk(hex2ua(env.dataOwnerDetails[hcp1Username].privateKey))
    )
  })

  it('should be capable of creating a patient from scratch', async () => {
    try {
      const rawPatientApiForHcp = new IccPatientApi(
        env.iCureUrl,
        {},
        new BasicAuthenticationProvider(env.dataOwnerDetails[hcp1Username].user, env.dataOwnerDetails[hcp1Username].password)
      )
      const patient = await rawPatientApiForHcp.createPatient(new Patient({ id: api.cryptoApi.randomUuid(), firstName: 'Tasty', lastName: 'Test' }))
      const pwd = api.cryptoApi.randomUuid()
      const tmpUser = await api.userApi.createUser(
        new User({ id: api.cryptoApi.randomUuid(), login: api.cryptoApi.randomUuid(), passwordHash: pwd, patientId: patient.id })
      )

      try {
        const { cryptoApi } = await Api(env.iCureUrl, tmpUser.id!, pwd, crypto)
        const rawPatientApi = new IccPatientApi(env.iCureUrl, {}, new BasicAuthenticationProvider(tmpUser.id!, pwd))
        const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
        const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
        await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })

        try {
          const { userApi, patientApi, cryptoApi: updatedCryptoApi } = await Api(env.iCureUrl, tmpUser.id!, pwd!, crypto)
          await updatedCryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
            patient.id!,
            new Uint8Array((await updatedCryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
          )
          const user = await userApi.getCurrentUser()
          let me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKeys(me, user.patientId!)
          me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKeys(me, hcpUser.healthcarePartyId!)

          me = await patientApi.getPatientWithUser(user, user.patientId!)
          me = await patientApi.modifyPatientWithUser(user, await patientApi.initDelegationsAndEncryptionKeys(me, user))

          const sek = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.encryptionKeys)
          const sdk = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.delegations)

          me = await patientApi.modifyPatientWithUser(
            user,
            await updatedCryptoApi.addDelegationsAndEncryptionKeys(
              null,
              me,
              user.patientId!,
              hcpUser.healthcarePartyId!,
              sdk.extractedKeys[0],
              sek.extractedKeys[0]
            )
          )
          await patientApi.modifyPatientWithUser(user, new Patient({ ...me, note: 'This is secret' }))

          const pat2 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
          expect(pat2 != null)
          expect(pat2.note != null)
        } catch (e) {
          console.log('Error in phase 3')
          throw e
        }
      } catch (e) {
        console.log('Error in phase 2')
        throw e
      }
    } catch (e) {
      console.log('Error in phase 1')
      throw e
    }
  }).timeout(60000)

  it('should be capable of logging in and encryption', async () => {
    const { cryptoApi, userApi } = await Api(env.iCureUrl, env.dataOwnerDetails[patUsername].user, env.dataOwnerDetails[patUsername].password, crypto)
    const rawPatientApi = new IccPatientApi(
      env.iCureUrl,
      {},
      new BasicAuthenticationProvider(env.dataOwnerDetails[patUsername].user, env.dataOwnerDetails[patUsername].password)
    )

    const user = await userApi.getCurrentUser()
    const patient = await rawPatientApi.getPatient(user.patientId!)

    if (!patient.publicKey) {
      const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
      const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
      await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })
      await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
        patient.id!,
        new Uint8Array((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
      )
    }
    const {
      calendarItemApi,
      patientApi,
      cryptoApi: updatedCryptoApi,
    } = await Api(env.iCureUrl, env.dataOwnerDetails[patUsername].user, env.dataOwnerDetails[patUsername].password, crypto)
    await updatedCryptoApi.loadKeyPairsAsJwkInBrowserLocalStorage(user.patientId!, pkcs8ToJwk(hex2ua(env.dataOwnerDetails[patUsername].privateKey)))

    await patientApi.modifyPatientWithUser(
      user,
      await updatedCryptoApi.addDelegationsAndEncryptionKeys(
        null,
        { ...(await patientApi.getPatientWithUser(user, user.patientId!)), note: 'Secret note' },
        user.patientId!,
        hcpUser.healthcarePartyId!,
        null,
        null
      )
    )
    const ci = await calendarItemApi.createCalendarItemWithHcParty(
      user,
      await calendarItemApi.newInstancePatient(
        user,
        patient,
        { patientId: patient.id, title: 'Secret title', details: 'Important and private information' },
        [hcpUser.healthcarePartyId!]
      )
    )

    const pat2 = await api.patientApi.getPatientWithUser(hcpUser, patient.id!)
    const ci2 = await api.calendarItemApi.getCalendarItemWithUser(hcpUser, ci.id)

    expect(pat2 != null)
    expect(ci2 != null)
  }).timeout(60000)
})
