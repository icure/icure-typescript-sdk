import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'

export class FailAuthService implements AuthService {
  private static _instance: FailAuthService | null = null

  static getInstance(): FailAuthService {
    if (!FailAuthService._instance) {
      FailAuthService._instance = new FailAuthService()
    }
    return FailAuthService._instance
  }

  getAuthHeader(): Promise<Array<XHR.Header> | null> {
    return Promise.resolve(null)
  }
}
