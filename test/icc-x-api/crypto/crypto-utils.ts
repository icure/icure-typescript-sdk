import {Api, b64_2ua, b64Url2ua, UtilsClass} from '../../../icc-x-api'
import {expect} from 'chai'

import 'mocha'
import {hex2ua, ua2hex} from '../../../index'
import {crypto} from '../../../node-compat'
import {RSAUtils} from '../../../icc-x-api/crypto/RSA'
import {parseAsn1} from '../../../icc-x-api/utils/asn1-parser'

const iCureUrl = process.env.ICURE_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcpUserName = process.env.HCP_USERNAME!
const hcpPassword = process.env.HCP_PASSWORD!
const hcpPrivKey = process.env.HCP_PRIV_KEY!

describe('ArrayBuffer methods', () => {
  let utils: UtilsClass
  let rsa: RSAUtils

  before(() => {
    utils = new UtilsClass()
    rsa = new RSAUtils(crypto)
  })

  describe('truncateTrailingNulls', () => {
    it('should truncate trailing nulls out of an Uint8Array without copying', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalArray = Uint8Array.from([...bytes, 0, 0])
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })

    it('should preserve the offset into the buffer', () => {
      const bytes = [72, 101, 108, 108, 111, 33]
      const originalBuffer = new Uint8Array([0, 0, ...bytes, 0, 0]).buffer
      const originalArray = new Uint8Array(originalBuffer, 2, bytes.length)
      const truncatedArray = utils.truncateTrailingNulls(originalArray)
      expect(truncatedArray.buffer).to.equal(originalArray.buffer)
      expect(truncatedArray.byteOffset).to.equal(originalArray.byteOffset)
      expect(Array.from(truncatedArray)).to.eql(bytes)
    })
  })

  describe('convertKeysFormat', () => {
    it('should manage jwk conversions for private keys gracefully', async () => {
      const { healthcarePartyApi } = await Api(iCureUrl, hcpUserName, hcpPassword, crypto)
      const privKey = hcpPrivKey
      const parsed = parseAsn1(new Uint8Array(hex2ua(privKey)))

      const jwk1 = utils.pkcs8ToJwk(hex2ua(privKey))
      const pkcs8 = utils.jwk2pkcs8(jwk1)
      const jwk2 = utils.pkcs8ToJwk(hex2ua(pkcs8))

      expect(jwk1.n).to.equal(jwk2.n)

      const pubKey = await healthcarePartyApi.getCurrentHealthcareParty().then((hcp) => hcp.publicKey)
      const jwk3 = utils.spkiToJwk(hex2ua(pubKey))
      const spki = utils.jwk2spki(jwk3)
      const jwk4 = utils.spkiToJwk(hex2ua(spki))

      expect(jwk3.n).to.equal(jwk4.n)
    })

    describe('convertKeysFormat', () => {
      it('should manage pkcs1 to jwk conversions for private keys gracefully', async () => {
        const privKeyPkcs1 = b64_2ua(
          'MIIEowIBAAKCAQEA3/qLp3xImhF0Ksxc6IZP/EFEZD8hbLGZDeIDhRKafrX07VDvaFr12hcPw1qRC4x0CqEARj2SN5+7/bHEOS1TZDdAPrCUZBRjTls/1hMtop2WPsvny6NO/OSjtAQHJKY+GIyGhZKtsOFe1lX0O//xyYEbfEUEl9ASfqdiodOpgLRIoigRBErEafPXUka/5k6o0/aUpASgrlSAvroXiYMHnF9L8vCu5F79lCmYcgtpiSwlczscuIfidZmPRZ8SZx8XyF0NDAp+q4aSGMpCg1wgvoyTh2iLbOMsB05fgNc98UepeAIj8uwS2WOwCq8+a8mlIF/OmCSvMBwz9+qYDaVYzwIDAQABAoIBAAkQ+RPhAzFVW93wTXcjb1vB1T+3kdChXxWBnMHcucCU+KKd6ur5pPJcikij7bN0I9ha9woLgP6GapN/iCFbtStH1JkVCGoFV0Bl5NoeBvQKVqQZGJC/fg7c6cbQ05cyBtkd4G4fZ1oobUXWJIpEjH2AdTkyXq1kgJ3RhGZnjSNxVWJIqZVCYBZH2/YFCWKwOanTWe7TrGBo9SpumQ+q4V+B0I0G4lxSxWcSNFosotbRdueMDQ8L/wVlX/XljdvIvjk6RRFOK+4DOtWV5TgiNYYyKd9YLsmHmLcgPEr9UeB0De8YIy8diXkpggTjwFIXe2B8ae4ZnwQ6caAZNH1zNmECgYEA8hS+tPPto/iW+/eXWN57Z21ApCg6C8InAN5FcnSEL7NliRO7JvyWzZfLXYm4kmorVJoDPRtxi13LB66+d7vJBMmzT7NfzqVM5PA/2J1yng9gGBmnyNvPrNlF4xHI7FXy1yQNV/1oxp/3aFzf30lxLw9YAZFeHp4IYBVCmVGrPWECgYEA7NtY72lr+HHBAEsh+VHg9O+H8q+V+CIa+uz5q+yNIS5TSsawKW1oES9oFJ/ii2N9Q5YrtEaBPX+iptyMo95X05jCUZy9rO9CQ33wCBNrSd7kKhgSOdplSiGa+1exINDARRGjKZrD0OCYkoZpZgA4L01xp3AqWebG0XgB3FlZlC8CgYBG4lgtODffiYz8XrVMamkMEeuZpcXJZ6JwGKWRLBkAtrEGgGaOteuaa9Y6n3cSOFBTx30nSX/n5SDsMPjIqo3j /wOoVMe7BKANcWPgk8naCnqC1BBTOjoHTN+v66c/vLMM2BuoJiWl83VIc9mB0kl4FDAa1WwP3wpoyBDmQAm6QQKBgQDIsbey7QXytxiNUhxQcKOHh2sPJN6TKPrpgWCw37hZ1DH5W0+rWqviW+P6DdvctglO+nC/yTn7TSoZ7ykwNNcAUSDeHEzPus/P9mcrwKCZMEbusATJhpdq7/ytWgmZP6ibHa2+NAgV9ijxhvjJ2AfDdQCHmtAX6yauGNyixAbWOwKBgAiik8GIFylxjiLG/b2xtSA4ps4+re5wHB8H3K5Ln/FAZOVLJkP9+RKkxN/Wgy/hRVcPkXzmINqQ9wC0Yxd5tyklNhG8ODuyKimfSWluT9wXfkZ9LgCFgdfSFDoHtMxLeUaqcVnBAjCjROdqBQFPEtppvrDpiph9ePGl+Spqj3iu'
        )
        const privKeyPkcs8 = b64_2ua(
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDI+aBfIbNc/DeJGpxCepaeCz8dRZpFZEdNd0ZjFA3Xiv+iTVgNHXnakKIglFJn9cjC1EGEGoi/7B+TxsZy4riCWpbFeUJd/GKpZZA/nlxJ1E0i2m7rMaMV26Pffw60JQNkzu0nL2CJHg4Q+cVaqr0tVev8J3Z7S+gD+1gnYLhwEyg0ckKLJFtcOleHf5WeEc5/9+LH/VpmxucTWzKLwMTY9paYSyg7ksUkR+T5rYVj6d8N3jvy0IpL8Cz66FXZ5Ci/9KDey3U+QIwZvkvLxOSopRsLP8M6D/L/XpL9MtDViue4nafY0FZACJ/eV9LboqF7fVRXwhCzrB+TXyrzcoqFAgMBAAECggEBAKSdUu6Y/AE91X9HfJY3MwdgzuF7EVGlQYICIHUnB+90us6F64lSi2yq6yEkXBsrBrYOhVtfIIOTNIomVoXjjp229afqGqJBB88YkX6Kh60xZ70UjaW3ko1kymVV/QUxDAaWN0nRVJD7PSpKa4xILYvkxNZUvIdhNTmNtjcK0gd5NGu7yuNdT5IXe4oO9Pd6NVaZS7MolRSGcGzjle5LSL8uoNs7Y+IZ7tU6TP7XMQrSkUZcUMqxGfvHpabq00ODlwqfOy1G1JL0lBy00RC45+kQzxwHlYoPmS+oniUC7Ltf8gmEVw/aoGNdiy3hBYzGx/Zc6vDr/Ckpss3iA4e3cgECgYEA+EeKzEcIwAFcwuNQ1ffnDoj6OpYl3pMWWRMSKISWMbswBxBckYXnd2DbAmT5BVK0eSdVBCTJHX+/QtRN7SViKF2b5j0O+CbeMlt3ipW/BWuoyM9y449oKU0D0gesWOzY4FAnzYZHJDeo4hzaGd0nsh18AhzUzTPS22Fchah+xv0CgYEAzzmDKrqlK0RmBgWSop90x6rsGJuAnEUZS+fs2bf0+cWIcvI9y+fPskKBGFTlG0KPYQ0BNcmYJsPxRTA3FsMzqcmh4H7Hizy6wNLphZdW3aBeQbDRmNlAr4coZ1ArWmMt4flUz3eck1R1fqyaF2SEJSzXk6IOi8+if9Q1r7M1HCkCgYAkGIKdYFZtU8VgsBu4f+ofutpmWh33VfsRyCwDqAMOB+Dbpg1POuCEApjUqElr9LI4SveZOp/iogf0d1k8+QpkQ/e+aXIbscrsF1Ax3cN/zj8jssVJQDgsiP3dMzBjXUvKkNy4jKUbJtxuwzMSP4zd4Ft/EyH9E2O8cVM6O1zzIQKBgEtSH0APuWthoCe+LM9ZYCwXD1veYb/rSceSVD/KoouK5g7Jx/Zumsqza5L5gJEI/26KOI9haCFnBTJd1Rg7+XJUbLdZvZP5jfP6dZDuMk+6M6hy6axCA0YJvYDX3forpIjHhLEoS8wtXcueVx/7lCCjDPSHafwdi3YlHyJu4/YJAoGAIFPLBPqE+t7JgyNCtexOzaDeGRRe602t/s9l9cIhBbFZd3D00EglgbjPyVK/dSIP+nEskZ75X9DccdGpKwfBsGgJNuqYq4RXSrmN8T3BoeAIs5NPgHZ8AIscTW2gWSP4wvgxpfnEjTVbUQvRlF9N1i5gLtY3U7er8HU47nfC/0I='
        )

        const jwk2 = utils.pkcs8ToJwk(privKeyPkcs8)
        const jwk1 = utils.pkcs8ToJwk(privKeyPkcs1)

        const privKeyPkcs1roundTrip = utils.jwk2pkcs1(jwk1)
        const privKeyPkcs8roundTrip = utils.jwk2pkcs8(jwk1)

        console.log(privKeyPkcs1roundTrip)
        console.log(privKeyPkcs8roundTrip)

        expect(privKeyPkcs1roundTrip).to.equal(ua2hex(privKeyPkcs1))
      })
    })

    it('should convert spki to jwk in a coherent way', async () => {
      const { healthcarePartyApi } = await Api(iCureUrl, hcpUserName, hcpPassword, crypto)
      const pubKey = await healthcarePartyApi.getCurrentHealthcareParty().then((hcp) => hcp.publicKey)

      const jwk1 = utils.spkiToJwk(hex2ua(pubKey))
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
