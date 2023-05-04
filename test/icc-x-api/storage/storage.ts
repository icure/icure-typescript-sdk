import { expect } from 'chai'
import { LocalStorageImpl } from '../../../icc-x-api'
import { tmpdir } from 'os'
import 'isomorphic-fetch'
import { TextDecoder, TextEncoder } from 'util'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 * 1024 * 1024)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder
const testStorage = new LocalStorageImpl()

describe('Test LocalStorageFacade abstraction', () => {
  it('should store and retrieve a keypair', async () => {
    const key = 'key'
    const keyPair = {
      publicKey: 'publicKey',
      privateKey: 'privateKey', // pragma: allowlist secret
    }
    await testStorage.setItem(key, JSON.stringify(keyPair))
    expect(await testStorage.getItem(key)).to.eq(JSON.stringify(keyPair))
  })

  it('should store and retrieve a string', async () => {
    const key = 'key'
    const value = 'value'
    await testStorage.setItem(key, value)
    expect(await testStorage.getItem(key)).to.eq(value)
  })

  it('should remove a key', async () => {
    const key = 'key'
    const value = 'value'
    await testStorage.setItem(key, value)
    expect(await testStorage.getItem(key)).to.eq(value)
    await testStorage.removeItem(key)
    expect(await testStorage.getItem(key)).to.be.undefined
  })
})
