import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi } from '../../icc-api'
import { LoginCredentials } from '../../icc-api/model/LoginCredentials'
import Header = XHR.Header
import { a2b } from '../utils'

export class JwtAuthService implements AuthService {
  private _error: Error | null = null
  private _currentPromise: Promise<{ authJwt?: string; refreshJwt?: string }> = Promise.resolve({})

  constructor(private authApi: IccAuthApi, private username: string, private password: string) {}

  async getAuthHeaders(): Promise<Array<Header>> {
    return this._currentPromise
      .then(({ authJwt, refreshJwt }) => {
        if (!authJwt || this._isJwtInvalidOrExpired(authJwt)) {
          // If it does not have the JWT, tries to get it
          // If the JWT is expired, tries to refresh it

          this._currentPromise = this._refreshAuthJwt(refreshJwt).then((updatedTokens) => {
            // If here the token is null,
            // it goes in a suspension status
            if (!updatedTokens.authJwt) {
              throw new Error('Your iCure back-end version does not support JWT authentication')
            }

            return updatedTokens
          })
        } else if (!!this._error) {
          throw this._error
        }
        return this._currentPromise
      })
      .then(({ authJwt }) => {
        return [new XHR.Header('Authorization', `Bearer ${authJwt}`)]
      })
  }

  private async _refreshAuthJwt(refreshJwt: string | undefined): Promise<{ authJwt?: string; refreshJwt?: string }> {
    // If I do not have a refresh JWT or the refresh JWT is expired,
    // I have to log in again
    if (!refreshJwt || this._isJwtInvalidOrExpired(refreshJwt)) {
      return this._loginAndGetTokens()
    } else {
      return this.authApi.refreshAuthenticationJWT(refreshJwt).then((refreshResponse) => ({
        authJwt: refreshResponse.token,
        refreshJwt: refreshJwt,
      }))
    }
  }

  private async _loginAndGetTokens(): Promise<{ authJwt?: string; refreshJwt?: string }> {
    return this.authApi
      .login(
        new LoginCredentials({
          username: this.username,
          password: this.password,
        })
      )
      .then((authResponse) => ({
        authJwt: authResponse.token,
        refreshJwt: authResponse.refreshToken,
      }))
  }

  private _isJwtInvalidOrExpired(jwt: string): boolean {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
      return true
    }
    const payload = this._base64Decode(parts[1])
    // Using the 'exp' string is safe to use as it is part of the JWT RFC and cannot be modified by us.
    return !('exp' in payload) || payload['exp'] * 1000 < new Date().getTime()
  }

  private _base64Decode(encodedString: string): any {
    return JSON.parse(a2b(encodedString))
  }

  invalidateHeader(error: Error): void {
    this._error = error
  }

  isInErrorState(): boolean {
    return !!this._error
  }
}
