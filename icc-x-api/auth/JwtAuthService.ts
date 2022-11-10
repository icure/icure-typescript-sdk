import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi } from '../../icc-api'
import { LoginCredentials } from '../../icc-api/model/LoginCredentials'
import Header = XHR.Header

export class JwtAuthService implements AuthService {
  private error: Error | null = null
  private _authJwt: string | undefined
  private _refreshJwt: string | undefined
  private _currentPromise: Promise<Array<XHR.Header>> = Promise.resolve([])

  constructor(private authApi: IccAuthApi, private username: string, private password: string) {}

  async getAuthHeaders(): Promise<Array<Header>> {
    return this._currentPromise.then(() => {
      if (!this._authJwt || this._isJwtExpired(this._authJwt)) {
        // If it does not have the JWT, tries to get it
        // If the JWT is expired, tries to refresh it

        this._currentPromise = this._refreshAuthJwt().then((updatedTokens) => {
          // If here the token is null,
          // it goes in a suspension status
          if (!updatedTokens.token) {
            throw new Error('Your iCure back-end version does not support JWT authentication')
          }

          this._authJwt = updatedTokens.token
          this._refreshJwt = updatedTokens.refreshToken
          return Promise.resolve([new XHR.Header('Authorization', `Bearer ${this._authJwt}`)])
        })
      } else if (!!this.error) {
        throw this.error
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
    return JSON.parse(Buffer.from(encodedString, 'base64').toString())
  }

  invalidateHeader(error: Error): void {
    this.error = error
  }

  isInErrorState(): boolean {
    return !!this.error
  }
}
