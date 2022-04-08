import { expect, use } from 'chai'
import 'mocha'
import { Api } from '../icc-x-api'
import { IccPatientApi } from '../icc-api'
import { User } from '../icc-api/model/User'
import { crypto } from '../node-compat'
import { b2a, ua2hex, hex2ua } from '../icc-x-api/utils/binary-utils'
import { Patient } from '../icc-api/model/Patient'

const jwkKey = {
  alg: 'RSA-OAEP',
  d: 'HywDcIJcA9pEqOYbtS9Ou7w4oVfMcDod1wcyxq1Pby-xuU1ahDgKyFueKC2bZT71scOEMjjapNQmXa3EhZuaTzOtPwxJxardALhdDUd2BwN9BE02MdurhWl5aCFC40MUs-hXpRqhTQ8wMa-msyNS_EvmFFVfuTK2-GnqZy439jCG8auAnuSkieIGIkHIBn3zv4izOmIt-nptHXi8g-9c6Oo6R6sEU0xGheTvpJmQ_ID1ps0n9c0mqu5QzOh-7qYXt-TreySV9fu6hE2mv7A7STD4c_IEiFr9dgr4rCrfTqSvVc9ay-K5WGG-pLuAYSIc01INhx0VgnUW1GyKRBAScQ',
  dp: 'PMsKBmP15g79tRAHfjoSRbsYERmvso2jsaW2vgC37nK2UOGljFJ6fGPYeECK1T1Nol2cLBAD8IduGJls6KDMMYoovwJPEw1W9iMYiSYNf9-2h747gya6ZCxoZrPQA16q-tQgENN4kr1gJ1JFFVKkMriI_eSLG2le7cdOpokUfkk',
  dq: 'cJQOvD06v7ebcWKW-hG2pwkokC_6U1Dg4YUCJedpoPlb8z17o7gckRakX1SUJtPboNPP9BkO6enwNJNQdFYVG__Ji4wIIlC7k5NI1OWxHb4VtRL-x5dhJ1AbA8TFN1CSEQjFwgNllJALwkpAlQBqfVSUEanmxTvItqy2iOz6qbE',
  e: 'AQAB',
  ext: true,
  key_ops: ['decrypt'],
  kty: 'RSA',
  n: 'v6Yl0DhGBN--PaitYHazLr_lCznExxqee8UoHIAy5LBs9ZxtIiPKoW1zwlJlVcC3j9PTd--YEXRaYAzce1DgBbclnjqJwNqTVa5XR9wGFFJb2ORORN-7X3h1bXSzdVUOEq1mKGKWH4Ehfa_QCRQaqhW4ImjSeMs1mzP_av03s8749GaIqqVpES6V0GYaHTSCN6_wT1kgSOfvp0QAxej6vIrozvymRVSWuyYVWszJsRXz5ro7g78uzmm8vlZ7I4oILuFVfZ127BU8d7pWdwPHaq60Z74VHXLB-hwqlFtm94S2L24QFEALJiPQcz6zvtlMp0Q_TkTcQIocXN1cwsNiAw',
  p: '4BVK1WjwMOi6qLbdeg_JoSoRkY_vlumSN8UlUOj9oG8bhgSVtkgWyltpguxKQ0U12DFHRDFMqfKA5KLzpalVrJT3x_LXW-yQCDUyVvHey_Qc51x7urDGRrToQkraJlZ7Ci5YpiYICYfnMAJ7eR0bNBMPH9A2XfDURlpeiUwfqrs',
  q: '2vI2yoCfc2Jfk4_u9SRF5acNdOuVXVwXS4rqCWbQEQor8ek7MFwjIxtYPsm1bKaab04tjN6FRaO6pPClnAtQrfnAfCUpXC_vgHwycdnZOJ8DkGwWYohqWLX6d_AlKiVbV42NIDRTBLzUq34GGivYaxQkc6O_JXjZ1jKS93j8JVk',
  qi: 'TL-324Yp1r3HZR-0yS754VSOY6gvw94ROp2vzwwQgja19DC_KaqDy5tQ_A2qn8Dws_tzJ7qNms7ip0vNlTz9TLI_n8pFItoSDaWv38ytzHsq6SL6K7PTabij19HoI5-Biz4z8pUu1b0UtndXGWFy9FIzNul66zFlYiT3VI2O3J8',
}

const hcpPrivKey =
  '308204bf020100300d06092a864886f70d0101010500048204a9308204a50201000282010100adc3ed6b841b49222c896704e3f5d66a0b54b2a15c903b95d3a9d196c1' +
  '10ecfdd2589b1087746736e41c4af5147ee431db7d5f0ba18a3039d63a4323687a86ea5dc57caaed2d4bec27a04db93fe31a2703f34427e5954c60938ca9648fe30f17f40' +
  'f23b37e93dafcbde732e879e4193b0d4d778ed6750b856e4b13289710cb6c4f8918f98ad450a549368ebc2f721a186f27299625480e0a5750aa53d6cd4bffbf3bbbeb87ef' +
  'c149dc3e7ade29b863f9ae5565fc4d2e5b61d723cc1d3cd4299fcbe6be0905bf866499cdf84a952254e93fe904fe82245238dfbd8d371ec59d7ee7059a14151acba9dda9f' +
  '4bffd1169a4ab40fef5fee854219016744deb39818d020301000102820101009a42494f1d642bb48edd1bfb9773f2f9093e13a6744a06dba7a0265432e917baed3583d354' +
  'acddc4391574e5c56030aca231d662b8f1b8865fcc313609d65c574b0fbaf0f2c537955a48513797a3c0dfc9fdf80f831cdb451137da594ff33ebf01073fa66544552ff25' +
  '68137289e7a579623a373c6a6f9a7669677579d64677133d48fd23b659ca7b4b54ea7cde28ba1d5e14afffa8084f2cd3f8e421a821d1d10e968c0639d37b8284d9efa8e37' +
  '2d76e2db1e5967b834c83e70330faec7f8c1e191e4d141e58872699498d7283aa485fbe711f930de25c8e0d3d27077a6630117cb6013d4e770a25193227ee4ed85fbf0532' +
  '5e492dc1d7755e07e84f00e117102818100e6f7b398fa5bc86ba0fbb576c4804014b5f5156e755366de56563504a926bcad7a6c08fc0bf97d910d40715c97478624e02a42' +
  '0f7131c443883d589eef765421441423be548c2464bb1c7a996dcb20f8d24b2b4d1fce2cad1873c7ec65846c6350e6c09b17d6ffb9d1063a5610f001f1cff289f9e8e33bf' +
  '700f1194b767c8bdf02818100c0991fca3950478993435ec435b156c3fc346a6d6580cf014290b2de64000aef02a85639b8c3ca020fdc31c6821514c0e5d0990977fda967' +
  '4412ebcfadd630450df51b5c3edf73fccc69245ecbc64fd5524bc0cdf8f70588eeebe9008bb5a0195fc016b55ad9a415123aeaa5df5542d6303baf5df117463ab3a6742c0' +
  'd68e01302818100d833782fb3f36499b338cb75a09d38deea30bfde04ff8c248606ee5c2d86b049677667b69ff2ec227298274577eaa0dc35e5f8ae81d40716fc1a08b1c6' +
  '102ad274eab146c1d7e95d4d756c21e10fab0e9fb373961f369cc56f453a18c432804f3b74b548b8b92dea1f8ac7e2b6ba23e7da32fc0b2e803f2a88fc27246786505b028' +
  '1802eed2031c58529e8fb588ede7fb695cd6ac5daa88cf2b57d391ac87a27235b86a0bf23432d218736b9668d3a30b7b236cdc7e581c91aa50be42a380a81f08e12453453' +
  '56467b6b674ce6d155c790aa22efca454fea3945bff776c36ebe9ba2468c6de11a8ee8387269deb10d793cecec031487c5fbd80fe47da130ed0ad762c102818100acb178b' +
  'cd8dd929c5ab109fd48355573304545747d53d318fc2993bce09077a42bacd88f104bac3616bf71af985885460f13a86e36a208a2676caeb6ec62a67bb7f7ad8e43df4770' +
  '6066c842c66d460e3c2e5427a90f77e1ae9f45e2b57fa89e0cfdd0a54a5ca6a6e6de2b681d80cfc3dacc239d5ee4b0b7b670c0701351934c'

describe('Patient', () => {
  it('should be capable of creating a patient from scratch', async () => {
    const {
      calendarItemApi: calendarItemApiForHcp,
      patientApi: patientApiForHcp,
      userApi: userApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = Api('https://kraken.icure.dev/rest/v1', 'demo-formations', '5ba921cf-9ea3-4163-a359-48f7db9cdf4e', crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()
    await cryptoApiForHcp.loadKeyPairsAsJwkInBrowserLocalStorage(hcpUser.healthcarePartyId!, cryptoApiForHcp.utils.pkcs8ToJwk(hex2ua(hcpPrivKey)))

    try {
      const rawPatientApiForHcp = new IccPatientApi('https://kraken.icure.dev/rest/v1', {
        Authorization: `Basic ${b2a(`${hcpUser.id}:5ba921cf-9ea3-4163-a359-48f7db9cdf4e`)}`,
      })
      const patient = await rawPatientApiForHcp.createPatient(new Patient({ id: cryptoApiForHcp.randomUuid(), firstName: 'Tasty', lastName: 'Test' }))
      const pwd = cryptoApiForHcp.randomUuid()
      const tmpUser = await userApiForHcp.createUser(
        new User({ id: cryptoApiForHcp.randomUuid(), login: cryptoApiForHcp.randomUuid(), passwordHash: pwd, patientId: patient.id })
      )

      try {
        const { cryptoApi } = Api('https://kraken.icure.dev/rest/v1', tmpUser.id!, pwd, crypto)
        const rawPatientApi = new IccPatientApi('https://kraken.icure.dev/rest/v1', { Authorization: `Basic ${b2a(`${tmpUser.id!}:${pwd}`)}` })
        const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
        const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
        await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })
        await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
          patient.id!,
          new Uint8Array((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
        )

        try {
          const {
            userApi,
            calendarItemApi,
            patientApi,
            cryptoApi: updatedCryptoApi,
          } = Api('https://kraken.icure.dev/rest/v1', tmpUser.id!, pwd!, crypto)
          const user = await userApi.getCurrentUser()
          let me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKey(me, user.patientId!)
          me = await patientApi.getPatientWithUser(user, user.patientId!)
          await updatedCryptoApi.getOrCreateHcPartyKey(me, '171f186a-7a2a-40f0-b842-b486428c771b')

          me = await patientApi.getPatientWithUser(user, user.patientId!)
          me = await patientApi.modifyPatientWithUser(user, await patientApi.initDelegations(me, user))

          const sek = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.encryptionKeys)
          const sdk = await updatedCryptoApi.extractKeysFromDelegationsForHcpHierarchy(me.id, me.id, me.delegations)

          me = await patientApi.modifyPatientWithUser(
            user,
            await updatedCryptoApi.addDelegationsAndEncryptionKeys(
              null,
              me,
              user.patientId!,
              '171f186a-7a2a-40f0-b842-b486428c771b',
              sdk.extractedKeys[0],
              sek.extractedKeys[0]
            )
          )
          await patientApi.modifyPatientWithUser(user, new Patient({ ...me, note: 'This is secret' }))

          const pat2 = await patientApiForHcp.getPatientWithUser(hcpUser, patient.id!)
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
    const patientLogin = 'ad@taktik.com'
    const token = '85c95456-cb06-4281-89f3-3edfddae0db2'
    const { cryptoApi, userApi } = Api('https://kraken.icure.dev/rest/v1', patientLogin, token, crypto)
    const rawPatientApi = new IccPatientApi('https://kraken.icure.dev/rest/v1', { Authorization: `Basic ${b2a(`${patientLogin}:${token}`)}` })

    const user = await userApi.getCurrentUser()
    const patient = await rawPatientApi.getPatient(user.patientId!)

    await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(user.patientId!, hex2ua(cryptoApi.utils.jwk2pkcs8(jwkKey)))

    if (!patient.publicKey) {
      const { publicKey, privateKey } = await cryptoApi.RSA.generateKeyPair()
      const publicKeyHex = ua2hex(await cryptoApi.RSA.exportKey(publicKey!, 'spki'))
      await rawPatientApi.modifyPatient({ ...patient, publicKey: publicKeyHex })
      await cryptoApi.loadKeyPairsAsTextInBrowserLocalStorage(
        patient.id!,
        new Uint8Array((await cryptoApi.RSA.exportKey(privateKey!, 'pkcs8')) as ArrayBuffer)
      )
    }
    const { calendarItemApi, patientApi, cryptoApi: updatedCryptoApi } = Api('https://kraken.icure.dev/rest/v1', user.id!, token!, crypto)

    await patientApi.modifyPatientWithUser(
      user,
      await updatedCryptoApi.addDelegationsAndEncryptionKeys(
        null,
        { ...(await patientApi.getPatientWithUser(user, user.patientId!)), note: 'Secret note' },
        user.patientId!,
        '171f186a-7a2a-40f0-b842-b486428c771b',
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
        ['171f186a-7a2a-40f0-b842-b486428c771b']
      )
    )

    const {
      calendarItemApi: calendarItemApiForHcp,
      patientApi: patientApiForHcp,
      userApi: userApiForHcp,
      cryptoApi: cryptoApiForHcp,
    } = Api('https://kraken.icure.dev/rest/v1', 'demo-formations', '5ba921cf-9ea3-4163-a359-48f7db9cdf4e', crypto)
    const hcpUser = await userApiForHcp.getCurrentUser()

    await cryptoApiForHcp.loadKeyPairsAsJwkInBrowserLocalStorage(hcpUser.healthcarePartyId!, cryptoApiForHcp.utils.pkcs8ToJwk(hex2ua(hcpPrivKey)))
    const pat2 = await patientApiForHcp.getPatientWithUser(hcpUser, patient.id!)
    const ci2 = await calendarItemApiForHcp.getCalendarItemWithUser(hcpUser, ci.id)

    expect(pat2 != null)
    expect(ci != null)
    expect(ci2 != null)
  }).timeout(60000)
})
