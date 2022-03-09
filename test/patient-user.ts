import { expect } from 'chai'
import 'mocha'
import { Api } from '../icc-x-api'
import { IccPatientApi } from '../icc-api'
import { ua2hex } from '../dist'
import { crypto } from '../node-compat'
import { b2a, hex2ua } from '../icc-x-api/utils/binary-utils'

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

describe('Patient', () => {
  it('should be capable of loging in and encryption', async () => {
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
    const { calendarItemApi, patientApi } = Api('https://kraken.icure.dev/rest/v1', user.id!, token!, crypto)

    const ci = calendarItemApi.createCalendarItemWithHcParty(
      user,
      await calendarItemApi.newInstancePatient(user, patient, {}, ['171f186a-7a2a-40f0-b842-b486428c771b'])
    )

    expect(ci != null)
  })
})
