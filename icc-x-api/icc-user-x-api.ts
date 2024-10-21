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

  getCurrentUser(bypassCache: boolean = false): Promise<User> {
    if (bypassCache) return (this.cachedCurrentUser = super.getCurrentUser())
    else return this.cachedCurrentUser ?? (this.cachedCurrentUser = super.getCurrentUser())
  }

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

  async subscribeToUserEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<User> | undefined,
    eventFired: (user: User) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const rs = await subscribeToEntityEvents(this.host, this.authApi, 'User', eventTypes, filter, eventFired, options)
    return new ConnectionImpl(rs)
  }

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
