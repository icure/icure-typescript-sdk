import { IccUserApi } from '../icc-api/api/IccUserApi'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { AbstractFilter } from './filters/filters'
import { User } from '../icc-api/model/User'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { a2b, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { IccAuthApi } from '../icc-api'
import { objectEquals } from './utils/collection-utils'
import { XHR } from '../icc-api/api/XHR'
import XHRError = XHR.XHRError

export class IccUserXApi extends IccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  private cachedCurrentUser: Promise<User> | undefined

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    private readonly authApi: IccAuthApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.fetchImpl = fetchImpl
  }

  /**
   * Retrieves the currently logged-in user. Uses a cached version by default to avoid redundant API calls.
   * @param bypassCache if true, forces a fresh fetch from the server and updates the cache; otherwise returns the cached user if available.
   * @return the current user.
   */
  getCurrentUser(bypassCache: boolean = false): Promise<User> {
    if (bypassCache) return (this.cachedCurrentUser = super.getCurrentUser())
    else return this.cachedCurrentUser ?? (this.cachedCurrentUser = super.getCurrentUser())
  }

  /**
   * Modifies an existing user. If the user being modified is the current user, the local cache is updated accordingly.
   * Handles 409 conflict errors by re-fetching the latest revision and retrying when the only server-side changes
   * are to authenticationTokens or rev.
   * @param body the user with updated fields to persist.
   * @return the modified user as returned by the server.
   */
  async modifyUser(body?: User): Promise<User> {
    //If we do not load the current user, we cannot know if the modification is on the current user
    await this.getCurrentUser()
    if (this.cachedCurrentUser && (await this.cachedCurrentUser).id === body?.id) {
      try {
        const modifiedUser = await super.modifyUser(body).catch(async (e) => {
          //It is
          if (e.statusCode === 409) {
            let userInDb = await super.getCurrentUser()
            if (objectEquals((await this.cachedCurrentUser)!, userInDb, ['authenticationTokens', 'rev'])) {
              return await super.modifyUser({ ...body, rev: userInDb.rev, authenticationTokens: userInDb.authenticationTokens })
            }
          }
          throw e
        })
        this.cachedCurrentUser = Promise.resolve(modifiedUser)
        return modifiedUser
      } catch (e) {
        this.cachedCurrentUser = undefined
        throw e
      }
    } else return super.modifyUser(body)
  }

  /**
   * Subscribes to real-time user events using a WebSocket connection.
   * @param eventTypes the types of events to listen for (e.g. 'CREATE', 'UPDATE', 'DELETE').
   * @param filter an optional filter to restrict which user events trigger the callback.
   * @param eventFired the callback function invoked when a matching user event is received.
   * @param options optional subscription configuration such as connection parameters and retry behaviour.
   * @return a connection object that can be used to manage the WebSocket subscription lifecycle.
   */
  async subscribeToUserEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<User> | undefined,
    eventFired: (user: User) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const rs = await subscribeToEntityEvents(this.host, this.authApi, 'User', eventTypes, filter, eventFired, options)
    return new ConnectionImpl(rs)
  }

  /**
   * Checks whether the given password is valid for the currently logged-in user by attempting authentication.
   * @param password the password to verify.
   * @return true if the password is valid, false otherwise.
   */
  async checkPassword(password: string): Promise<boolean> {
    const userInfo = await this.getGroupAndUserIdFromToken()
    if (!!userInfo) {
      console.log(this.authApi)
      const loginUserId = !!userInfo.groupId ? `${userInfo.groupId}/${userInfo.userId}` : userInfo.userId
      try {
        return (await this.authApi.login({ username: loginUserId, password: password })).successful ?? false
      } catch (e) {
        return e instanceof XHRError && e.statusCode == 417
      }
    }
    throw Error('Could not get current group and user from jwt')
  }

  private async getGroupAndUserIdFromToken(): Promise<{ groupId: string | undefined; userId: string } | undefined> {
    const token = (await this.authenticationProvider.getIcureTokens())?.token
    if (!token) return undefined
    const splitToken = token.split('.')
    if (splitToken.length != 3) return undefined
    try {
      const tokenString = a2b(splitToken[1])
      const parsedClaims = JSON.parse(tokenString)
      if (!!parsedClaims['u']) {
        return { groupId: parsedClaims['g'], userId: parsedClaims['u'] }
      } else return undefined
    } catch {
      return undefined
    }
  }
}
