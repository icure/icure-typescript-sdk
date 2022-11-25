import { AuthService } from './AuthService'
import { IccAuthApi } from '../../icc-api'
import { EnsembleAuthService } from './EnsembleAuthService'
import { JwtAuthService } from './JwtAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'

export interface AuthenticationProvider {
  getAuthService(): AuthService
}

export class EnsembleAuthenticationProvider implements AuthenticationProvider {
  private readonly basicAuth: BasicAuthService
  private jwtAuth: JwtAuthService
  private suspensionEnd: Date | undefined

  constructor(private authApi: IccAuthApi, private username: string, private password: string, private jwtTimeout: number = 3600) {
    this.jwtAuth = new JwtAuthService(this.authApi, this.username, this.password)
    this.basicAuth = new BasicAuthService(this.username, this.password)
  }

  getAuthService(): AuthService {
    // If the jwtAuth is in an error state, it instantiates a new one,
    // but it will not use it until the suspension ends
    if (this.jwtAuth.isInErrorState()) {
      console.warn('Error state in JWT, I will skip it')
      this.jwtAuth = new JwtAuthService(this.authApi, this.username, this.password)
      this.suspensionEnd = new Date(new Date().getTime() + this.jwtTimeout * 1000)
    }

    return !!this.suspensionEnd && new Date() <= this.suspensionEnd
      ? new EnsembleAuthService(null, new NoAuthService(), this.basicAuth)
      : new EnsembleAuthService(this.jwtAuth, new NoAuthService(), this.basicAuth)
  }
}

export class BasicAuthenticationProvider implements AuthenticationProvider {
  constructor(private username: string, private password: string) {}

  getAuthService(): AuthService {
    return new BasicAuthService(this.username, this.password)
  }
}
