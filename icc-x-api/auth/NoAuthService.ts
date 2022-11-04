import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export class NoAuthService implements AuthService {
  private current: Array<XHR.Header> | null = []

  async getAuthHeaders(): Promise<Array<Header> | null> {
    if (!!this.current) {
      this.current = null
      return Promise.resolve([])
    }
    return Promise.resolve(null)
  }
}
