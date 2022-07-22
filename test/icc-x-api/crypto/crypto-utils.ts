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
          'MIIEpQIBAAKCAQEAuxbfTK0owZuDqBqzq6lyPUZiE1PTNH9Gkf5+zUpAygXunPzHnTRMaCof55b9gMv+NRdvj/8R/uH3F1Ppz/m7GGPJCedv5+Pwlskzho5GsasDmKR6pjceFBx2tQuu72UcQgVj8tB+BcJIWhXRka+ArqeLTvbgtEzoxrJ6x66uokYhSlWn7G0wemTsI3Rr1Zo0pLQEvXrJ20xFxkaAk19pL2zzsKz+KNdeVPPPFHWjJIXbur/GtXIK5Vk/iaRvQmfK7RjMIdCTImwbT+MKwAmt5oDFZnzaJQEp3deegOetis2yEYYa5/fu3mIUp06o1zbUDxcmR675M9SQMLnBFVXs6wIDAQABAoIBAA3DN/f3APmFDCFQnYjyNRIm3E4Zq37AIhvZQdCuNqfl2dC4k6KP11MOTjyGEe3ok7GqIK3SEKvUSY3wwVFoSIgZxw8wdD31uZwN/vlV/ANT1jbjWpZhlZfbJCxbSKoZoQOGS/zvs2WPDi16T2lNJMU0U/4iEROSWMlNFdUcl4IeUF+NRgVLCfkRpFu/QfIA9vOHVmzIJPyj3FVeM01w6qZrkXY6AiDwr/0uHM6TmZkr2WFlRWstdK9P1pHis90CfkkdazNPAsno+davdJOIo0DoIy09GiAk/4fhLGtW0pdhDLfFEXYI76rQHDezoBekBYaaOERitNYSMHmcbjrvWQECgYEA3Me8Z3pr2tuN4rBA0Uo6oqWrdjG1nCg2BSpJEOn9Ty1yumx0rkgWZnu9hcqBxgawxO8ICeKFxN/K3wd1aTBseFwaAyxw32ojdpb92dBTB7UYcFkA5m3nIGYJ0L6o2aWkYLW0w7jyn4uy81FqWVh6ih6jmJmroynNEfGhogqbYIECgYEA2O9DF2vXotLYqQ0OPKXgIVe/+F612Dfmka60z72Myjtr0CMqij0bMMehVq/U8xzMuQ86RQ6rEqHbl5bFvNv1hNIc4GP41xbeggMdaUbyc8Vusy5JKwiNVib/9+TNJGK2FV01sHDl486HCY5mUBCmqvmLj+C51R8pgHy/4DQ5F2sCgYEAn2TopcChq5GFX1smgLNZn+GB58Q9vK7fSV1dAQQd6JMEWIlCuCy9V2IQ003/4UslRhjYseJD934mxlxpLPdT6JV+BjqIhxPm5JBgV2fq+g6JxVrMppBEJITmozlzSCcphNTK299j80H1gWuPH1AcsCksrViMrTDZqBHOQuHriYECgYEA0i9wJ987PO1hMtoNc0GcWXH19CV/txDie0B0u9sB8GeGXFHWQ75U+/xQG/edMjgzOxK/+Gzv38unQca5q/TKe3hAtkDmty/XQszV0E0HWJhwW3d7ORC+MDz1QTAUey6RET4QaPXaJ9DREbdA9k5LzdifGjY4l3/r7CvylL7EmiUCgYEAsEBZYjlaNBtS2VSx7q7cE+JUz/tTQWoqnKXfzG2/ZGwQLm/XwRJ9BpAH6WhTwKosfBa05FabPUJ0L8e/ROrcKcNV8eAUNg3+Be9BwgF6gk8fYPLmBZjV6gxLzgVH+tocZUqrvESSA3+4ZtiTgwUk4c6JZN9S6erixaeSK/fGLxg='
        )
        const privKeyPkcs8 = b64_2ua(
          'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC7Ft9MrSjBm4OoGrOrqXI9RmITU9M0f0aR/n7NSkDKBe6c/MedNExoKh/nlv2Ay/41F2+P/xH+4fcXU+nP+bsYY8kJ52/n4/CWyTOGjkaxqwOYpHqmNx4UHHa1C67vZRxCBWPy0H4FwkhaFdGRr4Cup4tO9uC0TOjGsnrHrq6iRiFKVafsbTB6ZOwjdGvVmjSktAS9esnbTEXGRoCTX2kvbPOwrP4o115U888UdaMkhdu6v8a1cgrlWT+JpG9CZ8rtGMwh0JMibBtP4wrACa3mgMVmfNolASnd156A562KzbIRhhrn9+7eYhSnTqjXNtQPFyZHrvkz1JAwucEVVezrAgMBAAECggEADcM39/cA+YUMIVCdiPI1EibcThmrfsAiG9lB0K42p+XZ0LiToo/XUw5OPIYR7eiTsaogrdIQq9RJjfDBUWhIiBnHDzB0PfW5nA3++VX8A1PWNuNalmGVl9skLFtIqhmhA4ZL/O+zZY8OLXpPaU0kxTRT/iIRE5JYyU0V1RyXgh5QX41GBUsJ+RGkW79B8gD284dWbMgk/KPcVV4zTXDqpmuRdjoCIPCv/S4czpOZmSvZYWVFay10r0/WkeKz3QJ+SR1rM08Cyej51q90k4ijQOgjLT0aICT/h+Esa1bSl2EMt8URdgjvqtAcN7OgF6QFhpo4RGK01hIweZxuOu9ZAQKBgQDcx7xnemva243isEDRSjqipat2MbWcKDYFKkkQ6f1PLXK6bHSuSBZme72FyoHGBrDE7wgJ4oXE38rfB3VpMGx4XBoDLHDfaiN2lv3Z0FMHtRhwWQDmbecgZgnQvqjZpaRgtbTDuPKfi7LzUWpZWHqKHqOYmaujKc0R8aGiCptggQKBgQDY70MXa9ei0tipDQ48peAhV7/4XrXYN+aRrrTPvYzKO2vQIyqKPRswx6FWr9TzHMy5DzpFDqsSoduXlsW82/WE0hzgY/jXFt6CAx1pRvJzxW6zLkkrCI1WJv/35M0kYrYVXTWwcOXjzocJjmZQEKaq+YuP4LnVHymAfL/gNDkXawKBgQCfZOilwKGrkYVfWyaAs1mf4YHnxD28rt9JXV0BBB3okwRYiUK4LL1XYhDTTf/hSyVGGNix4kP3fibGXGks91PolX4GOoiHE+bkkGBXZ+r6DonFWsymkEQkhOajOXNIJymE1Mrb32PzQfWBa48fUBywKSytWIytMNmoEc5C4euJgQKBgQDSL3An3zs87WEy2g1zQZxZcfX0JX+3EOJ7QHS72wHwZ4ZcUdZDvlT7/FAb950yODM7Er/4bO/fy6dBxrmr9Mp7eEC2QOa3L9dCzNXQTQdYmHBbd3s5EL4wPPVBMBR7LpERPhBo9don0NERt0D2TkvN2J8aNjiXf+vsK/KUvsSaJQKBgQCwQFliOVo0G1LZVLHurtwT4lTP+1NBaiqcpd/Mbb9kbBAub9fBEn0GkAfpaFPAqix8FrTkVps9QnQvx79E6twpw1Xx4BQ2Df4F70HCAXqCTx9g8uYFmNXqDEvOBUf62hxlSqu8RJIDf7hm2JODBSThzolk31Lp6uLFp5Ir98YvGA=='
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
