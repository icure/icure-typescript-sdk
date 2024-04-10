import { AuthService } from './AuthService'
import { XHR } from '../../icc-api/api/XHR'
import { IccAuthApi, OAuthThirdParty } from '../../icc-api'
import { LoginCredentials } from '../../icc-api/model/LoginCredentials'
import Header = XHR.Header
import { a2b } from '../utils'
import { AuthenticationResponse } from '../../icc-api/model/AuthenticationResponse'
import XHRError = XHR.XHRError
import { JwtError } from './TokenException'

export class JwtBridgedAuthService implements AuthService {
  private _error: Error | null = null
  private _currentPromise: Promise<{ authJwt?: string; refreshJwt?: string }> = Promise.resolve({})

  constructor(
    private authApi: IccAuthApi,
    private username: string,
    private password: string,
    private thirdPartyTokens: { [thirdParty: string]: string } = {}
  ) {}

  async getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return this.getAuthHeaders().then(() => this._currentPromise.then(({ authJwt, refreshJwt }) => ({ token: authJwt!, refreshToken: refreshJwt! })))
  }

  async getAuthHeaders(): Promise<Array<Header>> {
    return this._currentPromise
      .then(
        ({ authJwt, refreshJwt }) => ({ authJwt, refreshJwt }),
        (e: Error) => {
          if (e instanceof JwtError) {
            const wrappedError = e.reason as any
            if (!!wrappedError.statusCode && wrappedError.statusCode >= 400 && wrappedError.statusCode < 500) {
              return { authJwt: undefined, refreshJwt: undefined }
            } else {
              return { authJwt: e.jwt, refreshJwt: e.refreshJwt }
            }
          } else {
            return { authJwt: undefined, refreshJwt: undefined }
          }
        }
      )
      .then(({ authJwt, refreshJwt }) => {
        if (!authJwt || this._isJwtInvalidOrExpired(authJwt)) {
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
    let authResponse: AuthenticationResponse | undefined
    let firstError: XHRError | undefined
    if (this.username && this.password) {
      try {
        authResponse = await this.authApi.login(
          new LoginCredentials({
            username: this.username,
            password: this.password,
          })
        )
      } catch (e) {
        firstError = e as XHRError
      }
    }
    if (!authResponse) {
      authResponse = await (Object.entries(this.thirdPartyTokens) as [OAuthThirdParty, string][]).reduce(async (acc, [thirdParty, token]) => {
        const prev = await acc
        return (
          prev ??
          (token
            ? this.authApi.loginWithThirdPartyToken(thirdParty, token).catch((e) => {
                if (!firstError) {
                  firstError = e as XHRError
                }
                return Promise.resolve() as Promise<undefined>
              })
            : undefined)
        )
      }, Promise.resolve() as Promise<AuthenticationResponse | undefined>)
    }

    if (!authResponse) {
      if (firstError) throw firstError
      throw new XHRError('', 'Unknown error', 401, 'Unauthorized', new Headers())
    }

    return {
      authJwt: authResponse.token,
      refreshJwt: authResponse.refreshToken,
    }
  }

  private _isJwtInvalidOrExpired(jwt: string): boolean {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
      return true
    }
    const payload = this._base64Decode(parts[1])
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
