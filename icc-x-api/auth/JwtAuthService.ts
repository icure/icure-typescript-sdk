import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi } from '../../icc-api'
import Header = XHR.Header
import { isJwtInvalidOrExpired } from './JwtUtils'
import { JwtError } from '../JwtError'

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
      .then(
        (x) => ({ authJwt: x?.authJwt, refreshJwt: x?.refreshJwt }),
        (e: Error) => {
          if (e instanceof JwtError && !!e.jwt && !!e.refreshJwt) {
            return { authJwt: e.jwt, refreshJwt: e.refreshJwt }
          } else {
            throw new Error('There was an error while refreshing the token, please re-instantiate the API.')
          }
        }
      )
      .then((x) => {
        const authJwt = x?.authJwt
        const refreshJwt = x?.refreshJwt

        if ((!authJwt || isJwtInvalidOrExpired(authJwt)) && refreshJwt) {
          // If it does not have the JWT, tries to get it
          // If the JWT is expired, tries to refresh it

          this._currentPromise = this._refreshAuthJwt(refreshJwt).then(
            (updatedTokens) => {
              // If here the token is null,
              // it goes in a suspension status
              if (!updatedTokens.authJwt) {
                throw new Error('Your iCure back-end version does not support JWT authentication')
              }

              return updatedTokens
            },
            (e: Error) => {
              throw new JwtError(authJwt, refreshJwt, 'There was an error while refreshing the token, please re-instantiate the API or try again.', e)
            }
          )
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
    if (isJwtInvalidOrExpired(refreshJwt)) {
      throw Error('Missing or expired refresh token: please log in again')
    } else {
      return this.authApi.refreshAuthenticationJWT(refreshJwt).then((refreshResponse) => ({
        authJwt: refreshResponse.token!,
        refreshJwt: refreshJwt,
      }))
    }
  }

  invalidateHeader(error: Error): void {
    this._error = error
  }

  isInErrorState(): boolean {
    return !!this._error
  }
}
