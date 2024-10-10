import { AuthService } from './AuthService'
import { IccAuthApi, OAuthThirdParty } from '../../icc-api'
import { EnsembleAuthService } from './EnsembleAuthService'
import { JwtBridgedAuthService } from './JwtBridgedAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'
import { JwtAuthService } from './JwtAuthService'

export interface AuthenticationProvider {
  getAuthService(): AuthService
  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined>
}

export class EnsembleAuthenticationProvider implements AuthenticationProvider {
  private readonly basicAuth: BasicAuthService
  private jwtAuth: JwtBridgedAuthService
  private suspensionEnd: Date | undefined

  constructor(
    private authApi: IccAuthApi,
    private username: string,
    private password: string,
    private jwtTimeout: number = 3600,
    thirdPartyTokens: { [thirdParty: string]: string } = {}
  ) {
    this.jwtAuth = new JwtBridgedAuthService(this.authApi, this.username, this.password, thirdPartyTokens)
    this.basicAuth = new BasicAuthService(this.username, this.password)
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return this.jwtAuth.getIcureTokens()
  }

  getAuthService(): AuthService {
    // If the jwtAuth is in an error state, it instantiates a new one,
    // but it will not use it until the suspension ends
    if (this.jwtAuth.isInErrorState()) {
      console.warn('Error state in JWT, I will skip it')
      this.jwtAuth = new JwtBridgedAuthService(this.authApi, this.username, this.password)
      this.suspensionEnd = new Date(new Date().getTime() + this.jwtTimeout * 1000)
    }

    return !!this.suspensionEnd && new Date() <= this.suspensionEnd
      ? new EnsembleAuthService(null, new NoAuthService(), this.basicAuth)
      : new EnsembleAuthService(this.jwtAuth, new NoAuthService(), this.basicAuth)
  }
}

export class JwtAuthenticationProvider implements AuthenticationProvider {
  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return this.jwtAuth.getIcureTokens()
  }
  private readonly jwtAuth: JwtAuthService | JwtBridgedAuthService

  /**
   * @internal
   * @param authApi
   * @param username
   * @param password
   * @param icureToken
   */
  constructor(authApi: IccAuthApi, username?: string, password?: string, icureToken?: { token: string; refreshToken: string }) {
    this.jwtAuth = icureToken
      ? new JwtAuthService(authApi, icureToken.token, icureToken.refreshToken)
      : new JwtBridgedAuthService(authApi, username!, password!)
  }

  getAuthService(): AuthService {
    return this.jwtAuth
  }
}

export class BasicAuthenticationProvider implements AuthenticationProvider {
  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return Promise.resolve() as Promise<undefined>
  }
  constructor(private username: string, private password: string) {}

  getAuthService(): AuthService {
    return new BasicAuthService(this.username, this.password)
  }
}

export class NoAuthenticationProvider implements AuthenticationProvider {
  getAuthService(): AuthService {
    return new NoAuthService()
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return Promise.resolve() as Promise<undefined>
  }
}
