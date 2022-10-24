import { StorageFacade } from './StorageFacade'

export class LocalStorageImpl implements StorageFacade<string> {
  async getItem(key: string): Promise<string | undefined> {
    return localStorage.getItem(key) ?? undefined
  }

  async deleteItem(key: string): Promise<void> {
    return localStorage.removeItem(key)
  }

  async setItem(key: string, valueToStore: string): Promise<void> {
    return localStorage.setItem(key, valueToStore)
  }

  async storeKeyPair(key: string, keyPair: { publicKey: any; privateKey: any }): Promise<void> {
    if (typeof Storage === 'undefined') {
      console.error('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO: encryption
    await this.setItem(key, JSON.stringify(keyPair))
  }
}
