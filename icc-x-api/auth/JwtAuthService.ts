import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi } from '../../icc-api'
import { LoginCredentials } from '../../icc-api/model/LoginCredentials'

export class JwtAuthService implements AuthService {
  private static _instance: JwtAuthService | null = null

  private _authJwt: string | undefined
  private _refreshJwt: string | undefined
  private _suspensionEnd: Date | undefined
  private _currentPromise: Promise<Array<XHR.Header> | null> = Promise.resolve(null)

  private constructor(
    private authApi: IccAuthApi,
    private username: string,
    private password: string,
    private suspensionIntervalSeconds: number = 3600
  ) {}

  static getInstance(authApi: IccAuthApi, username: string, password: string, suspensionIntervalSeconds: number = 3600) {
    if (!JwtAuthService._instance) {
      JwtAuthService._instance = new JwtAuthService(authApi, username, password, suspensionIntervalSeconds)
    }
    return JwtAuthService._instance
  }

  async getAuthHeader(): Promise<Array<XHR.Header> | null> {
    return this._currentPromise.then(() => {
      // If it is in a suspension status, the next link will handle the call
      if (!!this._suspensionEnd && new Date() < this._suspensionEnd) {
        this._currentPromise = Promise.resolve(null)
      } else if (!this._authJwt || this._isJwtExpired(this._authJwt)) {
        // If it does not have the JWT, tries to get it
        // If the JWT is expired, tries to refresh it

        this._currentPromise = this._refreshAuthJwt().then((updatedTokens) => {
          // If here the token is null,
          // it goes in a suspension status
          if (!!updatedTokens.token) {
            this._suspensionEnd = new Date(new Date().getTime() + this.suspensionIntervalSeconds * 1000)
            return Promise.resolve(null)
          }

          this._authJwt = updatedTokens.token
          this._refreshJwt = updatedTokens.refreshToken
          return Promise.resolve([new XHR.Header('Authorization', `Bearer ${this._authJwt}`)])
        })
      } else {
        this._currentPromise = Promise.resolve([new XHR.Header('Authorization', `Bearer ${this._authJwt}`)])
      }

      return this._currentPromise
    })
  }

  private async _refreshAuthJwt(): Promise<{ token: string | undefined; refreshToken: string | undefined }> {
    // If I do not have a refresh JWT or the refresh JWT is expired,
    // I have to log in again
    if (!this._refreshJwt || this._isJwtExpired(this._refreshJwt)) {
      return this._loginAndGetTokens()
    } else {
      return this.authApi.refreshAuthenticationJWT(this._refreshJwt).then((refreshResponse) => ({
        token: refreshResponse.token,
        refreshToken: this._refreshJwt,
      }))
    }
  }

  private async _loginAndGetTokens(): Promise<{ token: string | undefined; refreshToken: string | undefined }> {
    return this.authApi
      .login(
        new LoginCredentials({
          username: this.username,
          password: this.password,
        })
      )
      .then((authResponse) => ({
        token: authResponse.token,
        refreshToken: authResponse.refreshToken,
      }))
  }

  private _isJwtExpired(jwt: string): boolean {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
      return false
    }
    const payload = this._base64Decode(parts[1])
    return 'exp' in payload && payload['exp'] > new Date().getTime()
  }

  private _base64Decode(encodedString: string): any {
    return JSON.parse(!!window.atob ? window.atob(encodedString) : new Buffer(encodedString, 'base64').toString())
  }
}
