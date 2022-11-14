import { StorageFacade } from './StorageFacade'

export class LocalStorageImpl implements StorageFacade<string> {
  getItem(key: string): string | undefined {
    return localStorage.getItem(key) ?? undefined
  }

  deleteItem(key: string): void {
    return localStorage.removeItem(key)
  }

  setItem(key: string, valueToStore: string): void {
    return localStorage.setItem(key, valueToStore)
  }

  storeKeyPair(key: string, keyPair: { publicKey: any; privateKey: any }): void {
    if (typeof Storage === 'undefined') {
      console.error('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO: encryption
    this.setItem(key, JSON.stringify(keyPair))
  }
}
