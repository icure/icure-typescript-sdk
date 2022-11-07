import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export class BasicAuthService implements AuthService {
  constructor(private username: string, private password: string) {}

  getAuthHeaders(): Promise<Array<Header> | null> {
    const encodedUsernamePassword = this._base64Encode(`${this.username}:${this.password}`)
    return Promise.resolve([new Header('Authorization', `Basic ${encodedUsernamePassword}`)])
  }

  private _base64Encode(decodedString: string): string {
    return Buffer.from(decodedString).toString('base64')
  }
}
