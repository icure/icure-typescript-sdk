import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'

export class BasicAuthService implements AuthService {
  private static _instance: BasicAuthService | null

  private constructor(private username: string, private password: string) {}

  static getInstance(username: string, password: string): BasicAuthService {
    if (!BasicAuthService._instance) {
      BasicAuthService._instance = new BasicAuthService(username, password)
    }
    return BasicAuthService._instance
  }

  getAuthHeader(): Promise<Array<XHR.Header> | null> {
    const encodedUsernamePassword = this._base64Encode(`${this.username}:${this.password}`)
    return Promise.resolve([new XHR.Header('Authorization', `Basic ${encodedUsernamePassword}`)])
  }

  private _base64Encode(decodedString: string): string {
    return JSON.parse(!!window.btoa ? window.btoa(decodedString) : Buffer.from(decodedString).toString('base64'))
  }
}
