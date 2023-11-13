import { AuthenticationProvider } from './AuthenticationProvider'
import { UserGroup } from '../../icc-api/model/UserGroup'
import { AuthService } from './AuthService'

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
 * A function used by the {@link SmartAuthProvider} to get the secrets (password, token, etc.) for authentication to the iCure SDK as needed.
 * The method takes in input the following parameters:
 * - the `login` of the user. This could be the username, email or "groupId/userId" if the login was done on a specific group.
 * - the `acceptedSecrets`, as explained below.
 * - the `authenticate` function, as explained below.
 *
 * ## Accepted secrets
 *
 * The method will be provided with an array of the secrets types that are acceptable (`acceptedSecrets`). Usually this array will contain multiple
 * elements, but this depend on the group configuration, the user (if he has 2fa setup or not), or the operation being performed. For groups using
 * default configurations and for patients without 2fa enabled for example the array will always contain the {@link AuthSecretType.PASSWORD} element.
 * Usually the array contain also the {@link AuthSecretType.LONG_LIVED_TOKEN} element, but if the user is attempting to perform a sensitive operations
 * such as changing his password the default group configuration does not allow for the user to authenticate using a JWT obtained from a long-lived
 * token for this operation, meaning the array will not contain the {@link AuthSecretType.LONG_LIVED_TOKEN} element.
 *
 * Regardless of the number of elements in the array only one secret of the accepted types is sufficient for the operation to succeed.
 *
 * ## Authenticate function
 *
 * The method will also be provided with a function `authenticate` which uses a secret to authenticate the user. This function takes in input the
 * secret and its type, then returns true if the secret could be used to authenticate the user, or false otherwise.
 *
 * Before returning the AuthSecretProvider function must make one successful call to the `authenticate` function. Calling the `authenticate` function
 * multiple times is allowed only as long as all previous calls have returned false. If the method returns before a successful call to the `authenticate`
 * function or if the `authenticate` function is called again after a successful call, the SDK will throw an error, without re-attempting any potential
 * pending requests. Next time the SDK needs to perform an authenticated request it will call the AuthSecretProvider function again.
 *
 * ## Two factor authentication token secret type
 *
 * The {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN} secret type is only used when the user has 2fa enabled. In this case the SDK will call
 * the AuthSecretProvider function twice, once containing the {@link AuthSecretType.PASSWORD} element in the `acceptedSecrets` array, and if the
 * provided secret is a valid password the SDK will immediately call the AuthSecretProvider function again, this time containing the
 * {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN} instead of the {@link AuthSecretType.PASSWORD} element.
 *
 * Any future call to the AuthSecretProvider function from the same provider instance will not contain the {@link AuthSecretType.PASSWORD} element
 * anymore, as it is cached, but it may contain the {@link AuthSecretType.TWO_FACTOR_AUTHENTICATION_TOKEN} element instead.
 *
 * Note that the 2fa token is not needed for logging in through a long-lived or short-lived token, it is only used in combination with a password.
 * If the user is using 2fa, and you get in input as `acceptedSecrets` an array `[PASSWORD, LONG_LIVED_TOKEN, SHORT_LIVED_TOKEN]`, and you pass to
 * authenticate a long-lived token, the SDK will not call the AuthSecretProvider function again to ask for the 2fa token.
 *
 * ## Sample implementation
 *
 * Here is a sample implementation of this function, which could work in situations where the user group uses the default configuration and 2fa
 * is not supported.
 *
 * ```javascript
 * if (acceptedSecrets.includes(AuthSecretType.LONG_LIVED_TOKEN)) {
 *   // Prefer no user interaction if possible
 *   const token = await tryLoadTokenFromStorage(login) // Load token from storage, if it exists
 *   if (token && await authenticate(token, AuthSecretType.LONG_LIVED_TOKEN)) return; // Token is not expired, no need to do anything more
 * }
 * if (acceptedSecrets.includes(AuthSecretType.PASSWORD)) {
 *   while (!(await authenticate(prompt("Insert password"), AuthSecretType.PASSWORD))) {}
 *   return;
 * }
 * throw new Error("Illegal state: no supported secret type is supported, group may be misconfigured.")
 * ```
 */
export type AuthSecretProvider = (
  login: string,
  acceptedSecrets: AuthSecretType[],
  authenticate: (secret: string, secretType: AuthSecretType) => Promise<boolean>
) => Promise<void>

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

class TokenProvider {
  constructor(private login: string, initialAuthSecret: string | undefined) {}
}
