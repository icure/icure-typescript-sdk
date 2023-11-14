import { AuthenticationProvider } from './AuthenticationProvider'
import { UserGroup } from '../../icc-api/model/UserGroup'
import { AuthService } from './AuthService'
import { IccAuthApi } from '../../icc-api'
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { decodeJwtClaims, isJwtInvalidOrExpired } from './JwtUtils'

/**
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
  getAuthService(): AuthService {
    throw 'TODO'
  }

  switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    throw 'TODO'
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return Promise.resolve(undefined)
  }
}

/**
 * Allows the {@link SmartAuthProvider} to get the secrets (password, token, etc.) for authentication to the iCure SDK as needed.
 */
export interface AuthSecretProvider {
  /**
   * Provides a secret for authentication to the iCure SDK within.
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
   * @param login the login of the user. This could be the username, the email, or the "groupId/userId" of the user.
   * @param acceptedSecrets the types of secrets that are acceptable for the operation being performed.
   * @param previousAttempts the secrets that were previously attempted by the SDK for this operation. This array will be empty the first time this
   * method is called for a given operation, but it may contain multiple elements if the SDK has already called this method multiple times because the
   * previously returned secrets were not valid. The first element is the first secret that was attempted, and the last element is the most recently
   * attempted.
   * @return a promise that resolves with the secret and the secret type to use for authentication. If the promise rejects then the ongoing SDK
   * operation will fail without being re-attempted.
   */
  getSecret(
    login: string,
    acceptedSecrets: AuthSecretType[],
    previousAttempts: { secret: string; secretType: AuthSecretType }[]
  ): Promise<{ secret: string; secretType: AuthSecretType }> // We may want to add some onSuccess callback in future or similar
}

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
  // EXTERNAL_AUTHENTICATION = 'EXTERNAL_AUTHENTICATION',
  /**
   * A special case of external authentication where the provider is a digital identity provider.
   * Not yet in use.
   */
  // DIGITAL_ID = 'DIGITAL_ID',
}

enum ServerAuthenticationClass {
  // DIGITAL_ID = 60,
  TWO_FACTOR_AUTHENTICATION = 50,
  SHORT_LIVED_TOKEN = 40,
  // EXTERNAL_AUTHENTICATION = 30,
  PASSWORD = 20,
  LONG_LIVED_TOKEN = 10,
}
type LongLivedSecretType =
  | ServerAuthenticationClass.LONG_LIVED_TOKEN
  | ServerAuthenticationClass.PASSWORD
  | ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION
class TokenProvider {
  constructor(
    private login: string,
    private currentLongLivedSecret: { value: string; type: LongLivedSecretType | undefined } | undefined,
    private readonly authApi: IccAuthApi,
    private readonly authSecretProvider: AuthSecretProvider
  ) {}

  async getToken(minimumAuthenticationClassLevel: number): Promise<{ token: string; refreshToken: string }> {
    if (!!this.currentLongLivedSecret && (!this.currentLongLivedSecret.type || this.currentLongLivedSecret.type >= minimumAuthenticationClassLevel)) {
      const resultWithCachedSecret = await this.doGetTokenWithSecret(this.currentLongLivedSecret.value, minimumAuthenticationClassLevel)
      if ('success' in resultWithCachedSecret) {
        return resultWithCachedSecret.success
      } else if (
        resultWithCachedSecret.failure === DoGetTokenResultFailureReason.NEEDS_2FA &&
        minimumAuthenticationClassLevel >= ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION
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
    const attempts: { secret: string; secretType: AuthSecretType }[] = []
    while (true) {
      const { secret, secretType } = await this.authSecretProvider.getSecret(this.login, [...acceptedSecrets], attempts)
      if (!acceptedSecrets.includes(secretType))
        throw new Error(`Accepted secret types are ${JSON.stringify(acceptedSecrets)}, but got a secret of type ${secretType}.`)
      attempts.push({ secret, secretType })
      const result = await this.doGetTokenWithSecret(secret, minimumAuthenticationClassLevel)
      if ('success' in result) {
        this.updateCachedSecret(secret, secretType)
        return result.success
      } else if (result.failure == DoGetTokenResultFailureReason.NEEDS_2FA) {
        return this.askTotpAndGetToken(secret, minimumAuthenticationClassLevel)
      } else if (secretType == AuthSecretType.PASSWORD && result.failure == DoGetTokenResultFailureReason.INVALID_AUTH_CLASS_LEVEL) {
        return this.askSecretAndGetToken(minimumAuthenticationClassLevel, false)
      } // else retry
    }
  }

  private async askTotpAndGetToken(password: string, minimumAuthenticationClassLevel: number): Promise<{ token: string; refreshToken: string }> {
    if (minimumAuthenticationClassLevel > ServerAuthenticationClass.TWO_FACTOR_AUTHENTICATION)
      throw new Error(
        "Internal error: asking for totp to login but minimumAuthenticationClassLevel is higher than TWO_FACTOR_AUTHENTICATION's level."
      )
    const attempts: { secret: string; secretType: AuthSecretType }[] = []
    while (true) {
      const { secret, secretType } = await this.authSecretProvider.getSecret(this.login, [AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN], attempts)
      if (secretType != AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN)
        throw new Error(`Was expecting a 2fa token but got a secret of type ${secretType}.`)
      attempts.push({ secret, secretType })
      const result = await this.doGetTokenWithSecret(`${password}|${secret}`, minimumAuthenticationClassLevel)
      if ('success' in result) {
        this.updateCachedSecret(password, AuthSecretType.PASSWORD)
        return result.success
      } else if (result.failure != DoGetTokenResultFailureReason.INVALID_2FA) {
        throw new Error(`Unexpected error while trying to login with (previously) valid password and 2fa token ${result.failure}.`)
      } // else retry
    }
  }

  private async doGetTokenWithSecret(secret: string, minimumAuthenticationClassLevel: number): Promise<DoGetTokenResult> {
    return this.authApi.login({ username: this.login, password: secret }).then(
      (authResult) => {
        const { token, refreshToken } = authResult
        if (!token || !refreshToken) throw new Error('Internal error: login succeeded but no token was returned. Unsupported backend version?')
        const claims = decodeJwtClaims(token)
        const authClassLevel = claims['authClassLevel']
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
        if (error.statusCode == 401) {
          return { failure: DoGetTokenResultFailureReason.INVALID_PW_OR_TOKEN }
        } else if (error.statusCode == 406) {
          return { failure: DoGetTokenResultFailureReason.INVALID_2FA }
        } else if (error.statusCode == 417) {
          return { failure: DoGetTokenResultFailureReason.INVALID_AUTH_CLASS_LEVEL }
        } else throw error
      }
    )
  }

  switchedGroup(newLogin: string): TokenProvider {
    return new TokenProvider(
      newLogin,
      this.currentLongLivedSecret ? { value: this.currentLongLivedSecret.value, type: undefined } : undefined,
      this.authApi,
      this.authSecretProvider
    )
  }

  private updateCachedSecret(secret: string, secretType: AuthSecretType) {
    if (secretType == AuthSecretType.LONG_LIVED_TOKEN || secretType == AuthSecretType.PASSWORD) {
      this.currentLongLivedSecret = { value: secret, type: ServerAuthenticationClass.LONG_LIVED_TOKEN }
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
