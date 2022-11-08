import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export class NoAuthService implements AuthService {
  private error: Error | null = null

  async getAuthHeaders(): Promise<Array<Header>> {
    if (!!this.error) {
      throw this.error
    }
    return Promise.resolve([])
  }

  invalidateHeader(error: Error): void {
    this.error = error
  }
}
