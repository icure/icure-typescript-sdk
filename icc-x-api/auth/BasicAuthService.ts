import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export class BasicAuthService implements AuthService {
  private error: Error | null = null

  constructor(private username: string, private password: string) {}

  getAuthHeaders(): Promise<Array<Header>> {
    if (!!this.error) {
      throw this.error
    }
    return Promise.resolve([new Header('Authorization', `Basic ${this._base64Encode(`${this.username}:${this.password}`)}`)])
  }

  private _base64Encode(decodedString: string): string {
    return Buffer.from(decodedString).toString('base64')
  }

  invalidateHeader(error: Error): void {
    this.error = error
  }
}
