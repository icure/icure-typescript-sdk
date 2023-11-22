import { AuthenticationProvider, NoAuthenticationProvider } from './AuthenticationProvider'
import { UserGroup } from '../../icc-api/model/UserGroup'
import { AuthService } from './AuthService'
import { IccAuthApi, OAuthThirdParty } from '../../icc-api'
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { decodeJwtClaims, isJwtInvalidOrExpired } from './JwtUtils'
import { AuthenticationResponse } from '../../icc-api/model/AuthenticationResponse'

/**
 * Needed by a {@link SmartAuthProvider} to get the secrets (password, token, etc.) for authentication to the iCure SDK as needed.
 */
export interface AuthSecretProvider {
  /**
   * Provides a secret for authentication to the iCure SDK.
   *
   * ## Accepted secrets
   *
   * The method will be provided with an array of the secrets types that are acceptable (`acceptedSecrets`). Usually this array will contain multiple
   * elements, but this depends on the group configuration, the user (if he has 2fa setup or not), or the operation being performed. For groups using
   * default configurations and for patients without 2fa enabled for example the array will always contain the {@link AuthSecretType.PASSWORD} element.
   * Usually the array contain also the {@link AuthSecretType.LONG_LIVED_TOKEN} element, but if the user is attempting to perform a sensitive operations
   * such as changing his password the default group configuration does not allow for the user to authenticate using a JWT obtained from a long-lived
   * token for this operation, meaning the array will not contain the {@link AuthSecretType.LONG_LIVED_TOKEN} element.
   *
   * Regardless of the number of elements in the array only one secret of the accepted types is sufficient for the operation to succeed.
   *
   * ## TWO_FACTOR_AUTHENTICATION_TOKEN secret type
   *
   * The {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN} secret type is only used when the user has 2fa enabled. In this case the SDK will call
   * this method twice, once containing the {@link AuthSecretType.PASSWORD} element in the `acceptedSecrets` array, and if the provided secret is a
   * valid password the SDK will immediately call this method again, this time containing the {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN}
   * instead of the {@link AuthSecretType.PASSWORD} element.
   *
   * Any future call to this method from the same provider instance will not contain the {@link AuthSecretType.PASSWORD} element anymore, as it is
   * cached, but it may contain the {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN} element instead.
   *
   * Note that the 2fa token is not needed for logging in through a long-lived or short-lived token, it is only used in combination with a password.
   * If the user is using 2fa, and you get in input as `acceptedSecrets` an array `[PASSWORD, LONG_LIVED_TOKEN, SHORT_LIVED_TOKEN]`, and you pass to
   * authenticate a long-lived token, the SDK will not call this method again to ask for the 2fa token.
   *
   * @param acceptedSecrets the types of secrets that are acceptable for the operation being performed.
   * @param previousAttempts the secrets that were previously attempted by the SDK for this operation. This array will be empty the first time this
   * method is called for a given operation, but it may contain multiple elements if the SDK has already called this method multiple times because the
   * previously returned secrets were not valid. The first element is the first secret that was attempted, and the last element is the most recently
   * attempted.
   * @return a promise that resolves with the secret and the secret type to use for authentication. If the promise rejects then the ongoing SDK
   * operation will fail without being re-attempted.
   */
  getSecret(acceptedSecrets: AuthSecretType[], previousAttempts: AuthSecretDetails[]): Promise<AuthSecretDetails>
}

// We may want to add some onSuccess callback in future or similar
export type AuthSecretDetails =
  | { value: string; secretType: Exclude<AuthSecretType, AuthSecretType.EXTERNAL_AUTHENTICATION> }
  | { value: string; secretType: AuthSecretType.EXTERNAL_AUTHENTICATION; oauthType: OAuthThirdParty }

/**
 * Represents a type of secret that can be used for authentication with iCure.
 */
export enum AuthSecretType {
  /**
   * Password chosen by the user.
   */
  PASSWORD = 'PASSWORD', // pragma: allowlist secret
  /**
   * Time based one time password provided by authenticator applications, generated on the basis of a timestamp and a shared secret between the iCure
   * server and the authenticator application.
   */
  TWO_FACTOR_AUTHENTICATION_TOKEN = 'TWO_FACTOR_AUTHENTICATION_TOKEN',
  /**
   * A short-lived iCure token, an internal authentication token that lasts 5 minutes or less. Unlike passwords these tokens usually are generated by
   * some component of iCure, and are not chosen by the user.
   */
  SHORT_LIVED_TOKEN = 'SHORT_LIVED_TOKEN',
  /**
   * A long-lived iCure token, an internal authentication token that lasts longer than 5 minutes. Unlike passwords these tokens usually are generated
   * by some component of iCure, and are not chosen by the user.
   */
  LONG_LIVED_TOKEN = 'LONG_LIVED_TOKEN',
  /**
   * A token provided by an external authentication provider (e.g. Oauth/Google).
   * Not yet in use.
   */
  EXTERNAL_AUTHENTICATION = 'EXTERNAL_AUTHENTICATION',
  /**
   * A special case of external authentication where the provider is a digital identity provider.
   * Not yet in use.
   */
  // DIGITAL_ID = 'DIGITAL_ID',
}

// Here starts internal entities that should not be used directly.

/**
 * @internal this class is meant for internal use only and may be changed without notice. The SmartAuthProvider will be initialised automatically
 * by the iCure api depending on the authentication options you provide.
 *
 * An authentication provider that automatically requests secrets for authentication as needed.
 *
 * This authentication provider can be initialised already with some secrets or tokens, and the provider will cache them and use them as needed for
 * as long as they remain valid. If at any point however the provider needs an updated secret or a secret of a different kind it will automatically
 * request this to the {@link SmartAuthProvider} to get the secret.
 *
 * An advantage of using this provider over others is that in case all the cached tokens and secrets were to expire while performing a request,
 * instead of having the request fail the provider will ask for new secrets from the {@link SmartAuthProvider} and the request will automatically
 * be retried with the new secret. Additionally, the provider may request updated secrets also for performing some sensitive operations (e.g. changing
 * password of the user) even if the cached tokens and/or did not expire. This could be the case for example if the cached secret is a long-lived
 * token, but in order to change the password the user needs to provide his current password.
 *
 * Note that in this context the cache of secrets and token is in memory only, and is not persisted in any way. Different instances of this provider
 * will not share the same cache.
 *
 */
export class SmartAuthProvider implements AuthenticationProvider {
  /**
   * Initialises a {@link SmartAuthProvider}.
   * @param authApi an "anonymous" {@link IccAuthApi} to use for authentication.
   * @param login
   * @param secretProvider
   * @param props optional initialisation properties.
   */
  static initialise(
    authApi: IccAuthApi,
    login: string,
    secretProvider: AuthSecretProvider,
    props: {
      initialSecret?: { plainSecret: string } | { oauthToken: string; oauthType: OAuthThirdParty }
      initialAuthToken?: string
      initialRefreshToken?: string
      loginGroupId?: string
    } = {}
  ): SmartAuthProvider {
    let initialSecret: CachedSecretType | undefined = undefined
    if (props.initialSecret) {
      if ('plainSecret' in props.initialSecret) {
        initialSecret = { value: props.initialSecret.plainSecret, type: undefined }
      } else {
        initialSecret = {
          value: props.initialSecret.oauthToken,
          type: ServerAuthenticationClass.EXTERNAL_AUTHENTICATION,
          oauthType: props.initialSecret.oauthType,
        }
      }
    }
    return new SmartAuthProvider(
      new TokenProvider(login, props.loginGroupId, initialSecret, props.initialAuthToken, props.initialRefreshToken, authApi, secretProvider),
      props.loginGroupId
    )
  }

  private constructor(private readonly tokenProvider: TokenProvider, private readonly groupId: string | undefined) {}

  getAuthService(): AuthService {
    return new SmartAuthService(this.tokenProvider)
  }

  async switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    if (newGroupId == this.groupId) return Promise.resolve(this)
    if (!matches.find((match) => match.groupId == newGroupId)) throw new Error('New group id not found in matches.')
    const switchedProvider = await this.tokenProvider.switchedGroup(newGroupId)
    return new SmartAuthProvider(switchedProvider, this.groupId)
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return Promise.resolve(undefined)
  }
}

enum ServerAuthenticationClass {
  // DIGITAL_ID = 60,
  TWO_FACTOR_AUTHENTICATION = 50,
  SHORT_LIVED_TOKEN = 40,
  EXTERNAL_AUTHENTICATION = 30,
  PASSWORD = 20,
  LONG_LIVED_TOKEN = 10,
}
// Secrets lasting more than 5 minutes -> makes sense to reuse them to get an elevated security jwt
type LongLivedSecretType = ServerAuthenticationClass.LONG_LIVED_TOKEN | ServerAuthenticationClass.PASSWORD
type CachedSecretType =
  | { value: string; type: LongLivedSecretType | undefined }
  | { value: string; type: ServerAuthenticationClass.EXTERNAL_AUTHENTICATION; oauthType: OAuthThirdParty }
// In some providers Oauth tokens may have short duration or may be usable only once. We only want to cache them if they are going to be reusable and
// if they last more than 5 minutes.
const longLivedOAuthTokens = new Set([OAuthThirdParty.GOOGLE])
class TokenProvider {
  constructor(
    private login: string,
    private groupId: string | undefined,
    private currentLongLivedSecret: CachedSecretType | undefined,
    private cachedToken: string | undefined,
    private cachedRefreshToken: string | undefined,
    private readonly authApi: IccAuthApi,
    private readonly authSecretProvider: AuthSecretProvider
  ) {}

  async getCachedOrRefreshedOrNewToken(): Promise<{ token: string; type: RetrievedTokenType }> {
    if (!!this.cachedToken && !isJwtInvalidOrExpired(this.cachedToken)) {
      return { token: this.cachedToken, type: RetrievedTokenType.CACHED }
    } else if (!!this.cachedRefreshToken && !isJwtInvalidOrExpired(this.cachedRefreshToken)) {
      return this.refreshAndCacheToken(this.cachedRefreshToken)
    } else {
      return { token: await this.getAndCacheNewToken(undefined), type: RetrievedTokenType.NEW }
    }
  }

  async getNewTokenWithClass(minimumAuthenticationClass: number): Promise<string> {
    return await this.getAndCacheNewToken(minimumAuthenticationClass)
  }

  private async getAndCacheNewToken(minimumAuthenticationClassLevel: number | undefined): Promise<string> {
    const { token, refreshToken } = await this.getNewToken(minimumAuthenticationClassLevel ?? 0)
    this.cachedToken = token
    this.cachedRefreshToken = refreshToken
    return token
  }

  private async refreshAndCacheToken(refreshToken: string): Promise<{ token: string; type: RetrievedTokenType }> {
    return await this.authApi.refreshAuthenticationJWT(refreshToken).then(
      (authResult) => {
        if (!authResult.token) throw new Error('Internal error: refresh succeeded but no token was returned. Unsupported backend version?')
        this.cachedToken = authResult.token
        return { token: authResult.token, type: RetrievedTokenType.REFRESHED }
      },
      async () => ({ token: await this.getAndCacheNewToken(undefined), type: RetrievedTokenType.NEW })
    )
  }

  private async getNewToken(minimumAuthenticationClassLevel: number): Promise<{ token: string; refreshToken: string }> {
    if (!!this.currentLongLivedSecret && (!this.currentLongLivedSecret.type || this.currentLongLivedSecret.type >= minimumAuthenticationClassLevel)) {
      const resultWithCachedSecret = await this.doGetTokenWithSecret(this.currentLongLivedSecret, minimumAuthenticationClassLevel)
      if ('success' in resultWithCachedSecret) {
        return resultWithCachedSecret.success
      } else if (
        resultWithCachedSecret.failure === DoGetTokenResultFailureReason.NEEDS_2FA &&
        minimumAuthenticationClassLevel <= ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION
      ) {
        return this.askTotpAndGetToken(this.currentLongLivedSecret.value, minimumAuthenticationClassLevel)
      } else return this.askSecretAndGetToken(minimumAuthenticationClassLevel, true)
    } else {
      return this.askSecretAndGetToken(minimumAuthenticationClassLevel, true)
    }
  }

  private async askSecretAndGetToken(
    minimumAuthenticationClassLevel: number,
    passwordIsValidAs2fa: boolean
  ): Promise<{ token: string; refreshToken: string }> {
    const acceptedSecrets = [
      minimumAuthenticationClassLevel <= ServerAuthenticationClass.LONG_LIVED_TOKEN ? [AuthSecretType.LONG_LIVED_TOKEN] : [],
      minimumAuthenticationClassLevel <= ServerAuthenticationClass.SHORT_LIVED_TOKEN ? [AuthSecretType.SHORT_LIVED_TOKEN] : [],
      minimumAuthenticationClassLevel <= ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION &&
      (passwordIsValidAs2fa || minimumAuthenticationClassLevel <= ServerAuthenticationClass.PASSWORD)
        ? [AuthSecretType.PASSWORD]
        : [],
    ].flat()
    if (!acceptedSecrets.length)
      throw new Error('Internal error: no secret type is accepted for this request. Group may be misconfigured, or client may be outdated.')
    const attempts: AuthSecretDetails[] = []
    while (true) {
      const secretDetails = await this.authSecretProvider.getSecret([...acceptedSecrets], attempts)
      if (!acceptedSecrets.includes(secretDetails.secretType))
        throw new Error(`Accepted secret types are ${JSON.stringify(acceptedSecrets)}, but got a secret of type ${secretDetails.secretType}.`)
      attempts.push(secretDetails)
      const result = await this.doGetTokenWithSecret(secretDetails, minimumAuthenticationClassLevel)
      if ('success' in result) {
        this.updateCachedSecret(secretDetails)
        return result.success
      } else if (result.failure == DoGetTokenResultFailureReason.NEEDS_2FA) {
        return this.askTotpAndGetToken(secretDetails.value, minimumAuthenticationClassLevel)
      } else if (secretDetails.value == AuthSecretType.PASSWORD && result.failure == DoGetTokenResultFailureReason.INVALID_AUTH_CLASS_LEVEL) {
        // If we tried a password, and it turns out that the user has 2fa not enabled next time we don't consider password valid
        return this.askSecretAndGetToken(minimumAuthenticationClassLevel, false)
      } // else retry
    }
  }

  private async askTotpAndGetToken(password: string, minimumAuthenticationClassLevel: number): Promise<{ token: string; refreshToken: string }> {
    if (minimumAuthenticationClassLevel > ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION)
      throw new Error(
        "Internal error: asking for totp to login but minimumAuthenticationClassLevel is higher than TWO_FACTOR_AUTHENTICATION's level."
      )
    const attempts: AuthSecretDetails[] = []
    while (true) {
      const details = await this.authSecretProvider.getSecret([AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN], attempts)
      if (details.secretType != AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
        throw new Error(`Was expecting a 2fa token but got a secret of type ${details.secretType}.`)
      attempts.push(details)
      const result = await this.doGetTokenWithSecret({ value: `${password}|${details.value}` }, minimumAuthenticationClassLevel)
      if ('success' in result) {
        this.updateCachedSecret({ value: password, secretType: AuthSecretType.PASSWORD })
        return result.success
      } else if (result.failure != DoGetTokenResultFailureReason.INVALID_2FA) {
        throw new Error(`Unexpected error while trying to login with (previously) valid password and 2fa token ${result.failure}.`)
      } // else retry
    }
  }

  private async doGetTokenWithSecret(
    secret: { value: string; oauthType?: OAuthThirdParty },
    minimumAuthenticationClassLevel: number
  ): Promise<DoGetTokenResult> {
    let authResultPromise: Promise<AuthenticationResponse>
    if ('oauthType' in secret && !!secret.oauthType) {
      authResultPromise = this.authApi.loginWithThirdPartyToken(secret.oauthType, secret.value)
    } else {
      authResultPromise = this.authApi.login({ username: this.login, password: secret.value }, this.groupId)
    }
    return authResultPromise.then(
      (authResult) => {
        const { token, refreshToken } = authResult
        if (!token || !refreshToken) throw new Error('Internal error: login succeeded but no token was returned. Unsupported backend version?')
        const claims = decodeJwtClaims(token)
        const authClassLevel = claims['tac']
        if (!authClassLevel || typeof authClassLevel !== 'number')
          throw new Error('Internal error: authClassLevel is not a number. Unsupported backend version?')
        if (authClassLevel < minimumAuthenticationClassLevel) {
          return { failure: DoGetTokenResultFailureReason.INVALID_AUTH_CLASS_LEVEL }
        } else {
          return { success: { token, refreshToken } }
        }
      },
      (error) => {
        if (!(error instanceof XHRError)) throw error
        if (error.statusCode == 401 || error.statusCode == 412) {
          // Password is wrong (401) or unacceptable (e.g. too short, 412)
          return { failure: DoGetTokenResultFailureReason.INVALID_PW_OR_TOKEN }
        } else if (error.statusCode == 406) {
          // Password is correct, but 2fa token is not
          return { failure: DoGetTokenResultFailureReason.INVALID_2FA }
        } else if (error.statusCode == 417) {
          // Password is correct, but the user has 2fa enabled and no 2fa token was provided
          return { failure: DoGetTokenResultFailureReason.NEEDS_2FA }
        } else throw error
      }
    )
  }

  async switchedGroup(newGroupId: string): Promise<TokenProvider> {
    const groupSwitchedTokens = this.cachedRefreshToken
      ? await this.authApi.switchGroup(this.cachedRefreshToken, newGroupId).then(
          (response) => {
            if (!response.token || !response.refreshToken)
              throw new Error('Internal error: group switch succeeded but no token was returned. Unsupported backend version?')
            return { token: response.token, refreshToken: response.refreshToken }
          },
          () => ({ token: undefined, refreshToken: undefined })
        )
      : { token: undefined, refreshToken: undefined }
    return new TokenProvider(
      this.login,
      newGroupId,
      this.currentLongLivedSecret ? { value: this.currentLongLivedSecret.value, type: undefined } : undefined,
      groupSwitchedTokens.token,
      groupSwitchedTokens.refreshToken,
      this.authApi,
      this.authSecretProvider
    )
  }

  private updateCachedSecret(details: AuthSecretDetails) {
    switch (details.secretType) {
      case AuthSecretType.PASSWORD:
        this.currentLongLivedSecret = { value: details.value, type: ServerAuthenticationClass.PASSWORD }
        break
      case AuthSecretType.LONG_LIVED_TOKEN:
        this.currentLongLivedSecret = { value: details.value, type: ServerAuthenticationClass.LONG_LIVED_TOKEN }
        break
      case AuthSecretType.EXTERNAL_AUTHENTICATION:
        if (longLivedOAuthTokens.has(details.oauthType)) {
          this.currentLongLivedSecret = {
            value: details.value,
            type: ServerAuthenticationClass.EXTERNAL_AUTHENTICATION,
            oauthType: details.oauthType,
          }
        }
        break
    }
  }
}
type DoGetTokenResult = { success: { token: string; refreshToken: string } } | { failure: DoGetTokenResultFailureReason }
enum DoGetTokenResultFailureReason {
  NEEDS_2FA,
  INVALID_2FA,
  INVALID_PW_OR_TOKEN,
  INVALID_AUTH_CLASS_LEVEL,
}
enum RetrievedTokenType {
  CACHED,
  REFRESHED,
  NEW,
}

enum SmartAuthServiceState {
  INITIAL,
  DONE_INITIAL,
  REATTEMPT,
  REATTEMPTED_WITH_NEW_UNBOUND_TOKEN,
  REATTEMPTED_WITH_AUTH_CLASS_SPECIFIC_TOKEN,
  EXPECT_REQUEST_WITH_SPECIFIC_AUTH_CLASS,
  TERMINAL_ERROR,
}
class SmartAuthService implements AuthService {
  private currentState:
    | { id: SmartAuthServiceState.INITIAL }
    | { id: SmartAuthServiceState.DONE_INITIAL; initialToken: string }
    | { id: SmartAuthServiceState.REATTEMPT; initialToken: string; initialError: Error }
    | { id: SmartAuthServiceState.REATTEMPTED_WITH_NEW_UNBOUND_TOKEN }
    | { id: SmartAuthServiceState.REATTEMPTED_WITH_AUTH_CLASS_SPECIFIC_TOKEN }
    | { id: SmartAuthServiceState.EXPECT_REQUEST_WITH_SPECIFIC_AUTH_CLASS; errorFromNewToken: Error }
    | { id: SmartAuthServiceState.TERMINAL_ERROR; error: Error } = { id: SmartAuthServiceState.INITIAL }

  constructor(private readonly tokenProvider: TokenProvider) {}

  async getAuthHeaders(minimumAuthenticationClassLevel: number | undefined): Promise<Array<XHR.Header>> {
    return [new XHR.Header('Authorization', `Bearer ${await this.getAuthToken(minimumAuthenticationClassLevel)}`)]
  }

  private async getAuthToken(minimumAuthenticationClassLevel: number | undefined): Promise<string> {
    switch (this.currentState.id) {
      case SmartAuthServiceState.INITIAL:
        if (minimumAuthenticationClassLevel != undefined) {
          throw new Error('Illegal state: cannot ask for a specific auth class level at the first request attempt.')
        } else {
          const { token } = await this.tokenProvider.getCachedOrRefreshedOrNewToken()
          this.currentState = { id: SmartAuthServiceState.DONE_INITIAL, initialToken: token }
          return token
        }
      case SmartAuthServiceState.REATTEMPT:
        if (minimumAuthenticationClassLevel != undefined) {
          const token = await this.tokenProvider.getNewTokenWithClass(minimumAuthenticationClassLevel)
          this.currentState = { id: SmartAuthServiceState.REATTEMPTED_WITH_AUTH_CLASS_SPECIFIC_TOKEN }
          return token
        } else {
          const { token } = await this.tokenProvider.getCachedOrRefreshedOrNewToken()
          if (token == this.currentState.initialToken) throw this.currentState.initialError
          this.currentState = { id: SmartAuthServiceState.REATTEMPTED_WITH_NEW_UNBOUND_TOKEN }
          return token
        }
      case SmartAuthServiceState.EXPECT_REQUEST_WITH_SPECIFIC_AUTH_CLASS:
        if (minimumAuthenticationClassLevel != undefined) {
          const token = await this.tokenProvider.getNewTokenWithClass(minimumAuthenticationClassLevel)
          this.currentState = { id: SmartAuthServiceState.REATTEMPTED_WITH_AUTH_CLASS_SPECIFIC_TOKEN }
          return token
        } else throw this.currentState.errorFromNewToken
      case SmartAuthServiceState.TERMINAL_ERROR:
        throw this.currentState.error
      default:
        throw new Error(`Illegal state: cannot get token in state ${this.currentState.id}.`)
    }
  }

  invalidateHeader(error: Error): void {
    switch (this.currentState.id) {
      case SmartAuthServiceState.DONE_INITIAL:
        this.currentState = { id: SmartAuthServiceState.REATTEMPT, initialToken: this.currentState.initialToken, initialError: error }
        break
      case SmartAuthServiceState.REATTEMPTED_WITH_NEW_UNBOUND_TOKEN:
        this.currentState = { id: SmartAuthServiceState.EXPECT_REQUEST_WITH_SPECIFIC_AUTH_CLASS, errorFromNewToken: error }
        break
      case SmartAuthServiceState.REATTEMPTED_WITH_AUTH_CLASS_SPECIFIC_TOKEN:
        this.currentState = { id: SmartAuthServiceState.TERMINAL_ERROR, error: error }
        break
      default:
        throw new Error(`Illegal state: cannot invalidate header in state ${this.currentState.id}.`)
    }
  }
}
