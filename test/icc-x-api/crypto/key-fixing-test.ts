import { before } from 'mocha'
import { getEnvironmentInitializer, getEnvVariables, TestVars } from '../../utils/test_utils'
import { webcrypto } from 'crypto'
import { hex2ua, IccCryptoXApi, ua2hex, ua2utf8, utf8_2ua } from '../../../icc-x-api'
import { AESUtils } from '../../../icc-x-api/crypto/AES'
import { expect } from 'chai'

describe('Test key validation', () => {
  before(async function () {
    this.timeout(600000)
  })

  it('key validation should only keep valid keys', async () => {
    const cryptoApi = new IccCryptoXApi(null as any, null as any, null as any, null as any, null as any, webcrypto as any, null as any, null as any)
    const uuidKey = cryptoApi.randomUuid()
    const validKeysCorrect = [
      'a'.repeat(32),
      'a'.repeat(64),
      ua2hex(webcrypto.getRandomValues(new Uint8Array(16))),
      ua2hex(webcrypto.getRandomValues(new Uint8Array(32))),
    ]

    const invalidKeys = [
      'a'.repeat(30),
      'a'.repeat(31),
      'a'.repeat(33),
      'a'.repeat(34),
      'a'.repeat(63),
      'a'.repeat(65),
      ua2hex(webcrypto.getRandomValues(new Uint8Array(31))),
      ua2hex(webcrypto.getRandomValues(new Uint8Array(33))),
      ua2hex(webcrypto.getRandomValues(new Uint8Array(31))) + 'x',
    ]
    expect(cryptoApi.filterAndFixValidEntityEncryptionKeyStrings([uuidKey, ...validKeysCorrect, ...invalidKeys])).to.have.members([
      uuidKey.replace(/-/g, ''),
      ...validKeysCorrect,
    ])
  })
})
