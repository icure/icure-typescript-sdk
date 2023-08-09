import { IccUserApi } from '../icc-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { AbstractFilter } from './filters/filters'
import { User } from '../icc-api/model/User'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { subscribeToEntityEvents } from './utils'
import { IccAuthApi } from '../icc-api'

export class IccUserXApi extends IccUserApi {
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>
  authApi: IccAuthApi
  private cachedCurrentUser: Promise<User> | undefined

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    authApi: IccAuthApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.fetchImpl = fetchImpl
    this.authApi = authApi
  }

  getCurrentUser(bypassCache: boolean = false): Promise<User> {
    if (bypassCache) return (this.cachedCurrentUser = super.getCurrentUser())
    else return this.cachedCurrentUser ?? (this.cachedCurrentUser = super.getCurrentUser())
  }

  async modifyUser(body?: User): Promise<User> {
    if (this.cachedCurrentUser && (await this.cachedCurrentUser).id === body?.id) {
      try {
        const modifiedUser = await super.modifyUser(body)
        this.cachedCurrentUser = Promise.resolve(modifiedUser)
        return modifiedUser
      } catch (e) {
        this.cachedCurrentUser = undefined
        throw e
      }
    } else return super.modifyUser(body)
  }

  subscribeToUserEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<User> | undefined,
    eventFired: (user: User) => Promise<void>,
    options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number } = {}
  ): Promise<Connection> {
    return subscribeToEntityEvents(this.host, this.authApi, 'User', eventTypes, filter, eventFired, options).then((rs) => new ConnectionImpl(rs))
  }
}
