import { StorageFacade } from './StorageFacade'

export class LocalStorageImpl implements StorageFacade<string> {
  async getItem(key: string): Promise<string | undefined> {
    return localStorage.getItem(key) ?? undefined
  }

  async removeItem(key: string): Promise<void> {
    return localStorage.removeItem(key)
  }

  async setItem(key: string, valueToStore: string): Promise<void> {
    if (typeof Storage === 'undefined') {
      console.error('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    return localStorage.setItem(key, valueToStore)
  }
}
