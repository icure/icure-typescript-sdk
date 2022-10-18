import {LocalStorageFacade} from "../../../icc-x-api/storage/LocalStorageFacade"
import {expect} from "chai"

const storage: Record<string, string> = {}

class TestStorage implements LocalStorageFacade {
  getItem(key: string): string | null {
    return storage[key] ?? null
  }

  removeItem(key: string): void {
    delete storage[key]
  }

  setItem(key: string, value: string): void {
    storage[key] = value
  }

  storeKeyPair(key: string, keyPair: { publicKey: any; privateKey: any }): void {
    storage[key] = JSON.stringify(keyPair)
  }
}

const testStorage = new TestStorage()

describe("Test LocalStorageFacade abstraction", () => {
  it("should store and retrieve a keypair", () => {
    const key = "key"
    const keyPair = {
      publicKey: "publicKey",
      privateKey: "privateKey",
    }
    testStorage.storeKeyPair(key, keyPair)
    expect(testStorage.getItem(key)).to.eq(JSON.stringify(keyPair))
    expect(storage[key]).to.eq(JSON.stringify(keyPair))
  })

  it("should store and retrieve a string", () => {
    const key = "key"
    const value = "value"
    testStorage.setItem(key, value)
    expect(testStorage.getItem(key)).to.eq(value)
    expect(storage[key]).to.eq(value)
  })

  it("should remove a key", () => {
    const key = "key"
    const value = "value"
    testStorage.setItem(key, value)
    expect(storage[key]).to.eq(value)
    testStorage.removeItem(key)
    expect(testStorage.getItem(key)).to.be.null
    expect(storage[key]).to.be.undefined
  })

  it("should remove a keypair", () => {
    const key = "key"
    const keyPair = {
      publicKey: "publicKey",
      privateKey: "privateKey",
    }
    testStorage.storeKeyPair(key, keyPair)
    expect(storage[key]).to.eq(JSON.stringify(keyPair))
    testStorage.removeItem(key)
    expect(testStorage.getItem(key)).to.be.null
    expect(storage[key]).to.be.undefined
  })
})
