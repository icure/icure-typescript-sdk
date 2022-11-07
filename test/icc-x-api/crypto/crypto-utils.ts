import { Api, b64Url2ua } from '../../../icc-x-api'
import { expect } from 'chai'

import 'mocha'
import { hex2ua, jwk2pkcs8, jwk2spki, pkcs8ToJwk, spkiToJwk, truncateTrailingNulls, ua2hex } from '../../../index'
import { crypto } from '../../../node-compat'
import { RSAUtils } from '../../../icc-x-api/crypto/RSA'
import { parseAsn1 } from '../../../icc-x-api/utils/asn1-parser'
import { getEnvironmentInitializer, getEnvVariables, hcp1Username, TestVars } from '../../utils/test_utils'

let env: TestVars | undefined

describe('ArrayBuffer methods', () => {
  let rsa: RSAUtils

  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    rsa = new RSAUtils(crypto)
  })

  describe('truncateTrailingNulls', () => {
    it('should truncate trailing nulls out of an Uint8Array without copying', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalArray = Uint8Array.from([...bytes, 0, 0])
      const truncatedArray = truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })

    it('should preserve the offset into the buffer', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalBuffer = new Uint8Array([0, 0, ...bytes, 0, 0]).buffer
      const originalArray = new Uint8Array(originalBuffer, 2, bytes.length)
      const truncatedArray = truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(truncatedArray.byteOffset).to.equal(originalArray.byteOffset)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })
  })

  describe('convertKeysFormat', () => {
    it('should manage jwk conversions for private keys gracefully', async () => {
      const { healthcarePartyApi } = await Api(
        env!.iCureUrl,
        env!.dataOwnerDetails[hcp1Username].user,
        env!.dataOwnerDetails[hcp1Username].password,
        crypto
      )
      const privKey = env!.dataOwnerDetails[hcp1Username].privateKey
      const parsed = parseAsn1(new Uint8Array(hex2ua(privKey)))

      const jwk1 = pkcs8ToJwk(hex2ua(privKey))
      const pkcs8 = jwk2pkcs8(jwk1)
      const jwk2 = pkcs8ToJwk(hex2ua(pkcs8))

      expect(jwk1.n).to.equal(jwk2.n)

      const pubKey = await healthcarePartyApi.getCurrentHealthcareParty().then((hcp) => hcp.publicKey)
      const jwk3 = spkiToJwk(hex2ua(pubKey))
      const spki = jwk2spki(jwk3)
      const jwk4 = spkiToJwk(hex2ua(spki))

      expect(jwk3.n).to.equal(jwk4.n)
    })

    it('should convert spki to jwk in a coherent way', async () => {
      const { healthcarePartyApi } = await Api(
        env!.iCureUrl,
        env!.dataOwnerDetails[hcp1Username].user,
        env!.dataOwnerDetails[hcp1Username].password,
        crypto
      )
      const pubKey = await healthcarePartyApi.getCurrentHealthcareParty().then((hcp) => hcp.publicKey)
      const jwk1 = spkiToJwk(hex2ua(pubKey))

      const rsaKey1 = await rsa.importKey('jwk', jwk1, ['encrypt'])
      const rsaKey2 = await rsa.importKey('spki', hex2ua(pubKey), ['encrypt'])
      const jwk2 = await rsa.exportKey(rsaKey2, 'jwk')
      const rsaKey3 = await rsa.importKey('jwk', jwk2, ['encrypt'])

      const n1 = ua2hex(b64Url2ua(jwk1.n))
      const n2 = ua2hex(b64Url2ua(jwk2.n!))

      expect(jwk1.n).to.equal(jwk2.n)
    })
  })
})
