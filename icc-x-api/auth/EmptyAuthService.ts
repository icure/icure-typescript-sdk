import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'

export class EmptyAuthService implements AuthService {
  private static _instance: EmptyAuthService | null = null

  static getInstance(): EmptyAuthService {
    if (!EmptyAuthService._instance) {
      EmptyAuthService._instance = new EmptyAuthService()
    }
    return EmptyAuthService._instance
  }

  async getAuthHeader(): Promise<Array<XHR.Header> | null> {
    return Promise.resolve([])
  }
}
