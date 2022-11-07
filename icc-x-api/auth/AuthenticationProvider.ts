import { AuthService } from './AuthService'
import { IccAuthApi } from '../../icc-api'
import { EnsembleAuthService } from './EnsembleAuthService'
import { JwtAuthService } from './JwtAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'
import { FailAuthService } from './FailAuthService'

export interface AuthenticationProvider {
  getAuthService(): AuthService
}

export class EnsembleAuthenticationProvider implements AuthenticationProvider {
  private readonly jwtAuth: JwtAuthService
  private readonly sessionAuth: NoAuthService
  private readonly basicAuth: BasicAuthService
  private readonly failAuth: FailAuthService

  constructor(authApi: IccAuthApi, username: string, password: string) {
    this.jwtAuth = new JwtAuthService(authApi, username, password)
    this.sessionAuth = new NoAuthService()
    this.basicAuth = new BasicAuthService(username, password)
    this.failAuth = new FailAuthService()
  }

  getAuthService(): AuthService {
    return new EnsembleAuthService(this.jwtAuth, this.sessionAuth, this.basicAuth, this.failAuth)
  }
}

export class BasicAuthenticationProvider implements AuthenticationProvider {
  constructor(private username: string, private password: string) {}

  getAuthService(): AuthService {
    return new BasicAuthService(this.username, this.password)
  }
}
