import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi, OAuthThirdParty } from '../../icc-api'
import { LoginCredentials } from '../../icc-api/model/LoginCredentials'
import Header = XHR.Header
import { a2b } from '../utils'
import { AuthenticationResponse } from '../../icc-api/model/AuthenticationResponse'
import XHRError = XHR.XHRError

/**
 * Differs from JwtBridgedAuthService in that it cannot create new refresh tokens
 */
export class JwtAuthService implements AuthService {
  private _error: Error | null = null
  private _currentPromise: Promise<{ authJwt: string; refreshJwt: string } | undefined> = Promise.resolve(undefined as any)

  constructor(private readonly authApi: IccAuthApi, initialJwt?: { authJwt: string; refreshJwt: string }) {
    if (!!initialJwt) {
      this._currentPromise = Promise.resolve(initialJwt)
    }
  }

  get refreshToken(): Promise<string | undefined> {
    return this._currentPromise.then((x) => x?.refreshJwt as any)
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return this._currentPromise.then((x) => (x ? { token: x.authJwt, refreshToken: x.refreshJwt } : undefined))
  }

  async getAuthHeaders(): Promise<Array<Header>> {
    return this._currentPromise
      .then((x) => {
        const authJwt = x?.authJwt
        const refreshJwt = x?.refreshJwt

        if ((!authJwt || this._isJwtInvalidOrExpired(authJwt)) && refreshJwt) {
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
      .then((x) => {
        return x?.authJwt ? [new XHR.Header('Authorization', `Bearer ${x.authJwt}`)] : Promise.reject('Cannot provide auth: No JWT')
      })
  }

  private async _refreshAuthJwt(refreshJwt: string): Promise<{ authJwt: string; refreshJwt: string }> {
    // If I do not have a refresh JWT or the refresh JWT is expired,
    // I have to log in again
    if (this._isJwtInvalidOrExpired(refreshJwt)) {
      throw Error('Missing or expired refresh token: please log in again')
    } else {
      return this.authApi.refreshAuthenticationJWT(refreshJwt).then((refreshResponse) => ({
        authJwt: refreshResponse.token!,
        refreshJwt: refreshJwt,
      }))
    }
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
