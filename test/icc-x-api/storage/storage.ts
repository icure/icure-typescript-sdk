import { expect } from 'chai'
import { LocalStorageImpl } from '../../../icc-x-api/storage/LocalStorageImpl'
import { tmpdir } from 'os'

import { TextDecoder, TextEncoder } from 'util'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 * 1024 * 1024)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder
const testStorage = new LocalStorageImpl()

describe('Test LocalStorageFacade abstraction', () => {
  it('should store and retrieve a keypair', () => {
    const key = 'key'
    const keyPair = {
      publicKey: 'publicKey',
      privateKey: 'privateKey', // pragma: allowlist secret
    }
    testStorage.storeKeyPair(key, keyPair)
    expect(testStorage.getItem(key)).to.eq(JSON.stringify(keyPair))
  })

  it('should store and retrieve a string', () => {
    const key = 'key'
    const value = 'value'
    testStorage.setItem(key, value)
    expect(testStorage.getItem(key)).to.eq(value)
  })

  it('should remove a key', () => {
    const key = 'key'
    const value = 'value'
    testStorage.setItem(key, value)
    expect(testStorage.getItem(key)).to.eq(value)
    testStorage.deleteItem(key)
    expect(testStorage.getItem(key)).to.be.undefined
  })

  it('should remove a keypair', () => {
    const key = 'key'
    const keyPair = {
      publicKey: 'publicKey',
      privateKey: 'privateKey', // pragma: allowlist secret
    }
    testStorage.storeKeyPair(key, keyPair)
    expect(testStorage.getItem(key)).to.eq(JSON.stringify(keyPair))
    testStorage.deleteItem(key)
    expect(testStorage.getItem(key)).to.be.undefined
  })
})
