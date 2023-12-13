import { IccUserApi } from '../icc-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { AbstractFilter } from './filters/filters'
import { User } from '../icc-api/model/User'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { subscribeToEntityEvents , SubscriptionOptions} from './utils'
import { IccAuthApi } from '../icc-api'
import {objectEquals} from "./utils/collection-utils";

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
    //If we do not load the current user, we cannot know if the modification is on the current user
    await this.getCurrentUser()
    if (this.cachedCurrentUser && (await this.cachedCurrentUser).id === body?.id) {
      try {
        const modifiedUser = await super.modifyUser(body).catch(async (e) => {
          //It is
          if (e.statusCode === 409) {
            let userInDb = await super.getCurrentUser();
            if (objectEquals((await this.cachedCurrentUser)!, userInDb, ['authenticationTokens', 'rev'])) {
              return await super.modifyUser({...body, rev: userInDb.rev, authenticationTokens: userInDb.authenticationTokens})
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

  async modifyUserInGroup(groupId: string, body?: User): Promise<User> {
    //If we do not load the current user, we cannot know if the modification is on the current user
    await this.getCurrentUser()
    if (this.cachedCurrentUser && (await this.cachedCurrentUser).id === body?.id && (await this.cachedCurrentUser).groupId === groupId) {
      try {
        const modifiedUser = await super.modifyUserInGroup(groupId, body).catch(async (e) => {
          //It is
          if (e.statusCode === 409) {
            let userInDb = await super.getCurrentUser();
            if (objectEquals((await this.cachedCurrentUser)!, userInDb, ['authenticationTokens', 'rev'])) {
              return await super.modifyUserInGroup(groupId, {...body, rev: userInDb.rev, authenticationTokens: userInDb.authenticationTokens})
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
    } else return super.modifyUserInGroup(groupId, body)
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
}
