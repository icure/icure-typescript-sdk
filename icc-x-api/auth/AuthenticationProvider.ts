import { AuthService } from './AuthService'
import { IccAuthApi } from '../../icc-api'
import { EnsembleAuthService } from './EnsembleAuthService'

export interface AuthenticationProvider {
  getAuthService(): AuthService
}

export class EnsembleAuthenticationProvider implements AuthenticationProvider {
  constructor(private authApi: IccAuthApi, private username: string, private password: string) {}

  getAuthService(): AuthService {
    return new EnsembleAuthService(this.authApi, this.username, this.password)
  }
}
