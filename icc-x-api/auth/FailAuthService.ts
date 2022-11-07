import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import Header = XHR.Header

export class FailAuthService implements AuthService {
  getAuthHeaders(): Promise<Array<Header> | null> {
    return Promise.resolve(null)
  }
}
