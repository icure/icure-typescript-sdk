import { AuthService } from './AuthService'
import { IccAuthApi } from '../../icc-api'
import { EnsembleAuthService } from './EnsembleAuthService'
import { JwtBridgedAuthService } from './JwtBridgedAuthService'
import { NoAuthService } from './NoAuthService'
import { BasicAuthService } from './BasicAuthService'
import { JwtAuthService } from './JwtAuthService'
import { UserGroup } from '../../icc-api/model/UserGroup'

/**
 * @internal you should not implement this interface yourself.
 */
export interface AuthenticationProvider {
  /**
   * @internal this method is meant for internal use only and may be changed without notice
   */
  getAuthService(): AuthService

  /**
   * @internal this method is meant for internal use only and may be changed without notice
   * Gives a new authentication provider for the same user and authentication method but for a different iCure group
   * @param newGroupId id of the new group to switch to
   * @param matches the list of groups the user is in, containing also the group-specific id of the user. Note that users with same login username but
   * different password are considered as if they are different users and should not appear in these matches. You can get this list by calling
   * {@link IccUserApi.getMatchingUsers} authenticated.
   * @return a new authentication provider
   */
  switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider>

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined>
}

export class EnsembleAuthenticationProvider implements AuthenticationProvider {
  private readonly basicAuth: BasicAuthService
  private jwtAuth: JwtAuthService | JwtBridgedAuthService
  private suspensionEnd: Date | undefined

  constructor(
    private readonly authApi: IccAuthApi,
    private readonly username: string,
    private readonly password: string,
    private readonly jwtTimeout: number = 3600,
    jwtAuth?: JwtAuthService | JwtBridgedAuthService,
    basicAuth?: BasicAuthService,
    thirdPartyTokens: { [thirdParty: string]: string } = {}
  ) {
    this.jwtAuth = jwtAuth ?? new JwtBridgedAuthService(this.authApi, this.username, this.password)
    this.basicAuth = basicAuth ?? new BasicAuthService(this.username, this.password)
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

  async switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    const switchInfo = await switchJwtAuth(this.authApi, this.jwtAuth, this.username, this.password, newGroupId, matches)
    return new EnsembleAuthenticationProvider(
      this.authApi,
      switchInfo.loginForGroup,
      this.password,
      this.jwtTimeout,
      switchInfo.switchedJwtAuth,
      new BasicAuthService(switchInfo.loginForGroup, this.password)
    )
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
   * @param jwtAuth
   * @param icureToken
   */
  constructor(
    private readonly authApi: IccAuthApi,
    private readonly username?: string,
    private readonly password?: string,
    jwtAuth?: JwtAuthService | JwtBridgedAuthService,
    private readonly icureToken?: { token: string; refreshToken: string }
  ) {
    const composedAuth =
      jwtAuth ??
      (icureToken
        ? new JwtAuthService(authApi, { authJwt: icureToken.token, refreshJwt: icureToken.refreshToken })
        : !!username && !!password
        ? new JwtBridgedAuthService(authApi, username!, password!)
        : undefined)
    if (!composedAuth) {
      throw new Error('No authentication method provided')
    }
    this.jwtAuth = composedAuth
  }

  getAuthService(): AuthService {
    return this.jwtAuth
  }

  async switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    const switchInfo = await switchJwtAuth(this.authApi, this.jwtAuth, this.username, this.password, newGroupId, matches)
    return new JwtAuthenticationProvider(this.authApi, switchInfo.loginForGroup, this.password, switchInfo.switchedJwtAuth)
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

  async switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    return Promise.resolve(new BasicAuthenticationProvider(loginForGroup(newGroupId, matches), this.password))
  }
}

export class NoAuthenticationProvider implements AuthenticationProvider {
  getAuthService(): AuthService {
    return new NoAuthService()
  }

  getIcureTokens(): Promise<{ token: string; refreshToken: string } | undefined> {
    return Promise.resolve() as Promise<undefined>
  }

  async switchGroup(newGroupId: string, matches: Array<UserGroup>): Promise<AuthenticationProvider> {
    return Promise.resolve(new NoAuthenticationProvider())
  }
}

/**
 * @internal
 */
function loginForGroup(groupId: string, matches: Array<UserGroup>): string {
  const matchForGroup = matches.find((x) => x.groupId === groupId)
  if (!matchForGroup?.userId) {
    throw new Error(`Can't switch to group ${groupId} for the current user.`)
  }
  return `${groupId}/${matchForGroup.userId}`
}

/**
 * @internal
 * Creates a jwtAuth from an existing one in order to switch group
 */
async function switchJwtAuth(
  authApi: IccAuthApi,
  jwtAuth: JwtAuthService | JwtBridgedAuthService,
  username: string | undefined,
  password: string | undefined,
  newGroupId: string,
  matches: Array<UserGroup>
): Promise<{ loginForGroup: string; switchedJwtAuth: JwtAuthService | JwtBridgedAuthService }> {
  const refreshToken = jwtAuth.isInErrorState() ? undefined : await jwtAuth.refreshToken
  const switchedJwtInfo = refreshToken ? await authApi.switchGroup(refreshToken, newGroupId).catch(() => undefined as any) : undefined
  const updatedLogin = loginForGroup(newGroupId, matches)
  const switchedJwtAuth =
    !!username && !!password
      ? new JwtBridgedAuthService(
          authApi,
          updatedLogin,
          password,
          switchedJwtInfo?.token && switchedJwtInfo?.refreshToken
            ? { authJwt: switchedJwtInfo.token, refreshJwt: switchedJwtInfo.refreshToken }
            : undefined
        )
      : new JwtAuthService(
          authApi,
          switchedJwtInfo?.token && switchedJwtInfo?.refreshToken
            ? { authJwt: switchedJwtInfo.token, refreshJwt: switchedJwtInfo.refreshToken }
            : undefined
        )
  return { loginForGroup: updatedLogin, switchedJwtAuth }
}
