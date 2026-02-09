import { IccAuthApi, IccHcpartyApi } from '../icc-api'
import { HealthcareParty } from '../icc-api/model/HealthcareParty'
import * as models from '../icc-api/model/models'
import { findName, garnishPersonWithName, hasName } from './utils/person-util'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { AbstractFilter } from './filters/filters'
import { subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { ListOfIds } from '../icc-api/model/models'
import { XHR } from '../icc-api/api/XHR'
import XHRError = XHR.XHRError

// noinspection JSUnusedGlobalSymbols
export class IccHcpartyXApi extends IccHcpartyApi {
  hcPartyKeysCache: { [key: string]: { [key: string]: string } } = {}
  hcPartyCache: { [key: string]: [number, Promise<HealthcareParty>] } = {}

  private CACHE_RETENTION_IN_MS = 300_000
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
  }

  private getHcPartyFromCache(key: string) {
    const hcpInCache = this.hcPartyCache[key]
    const now = Date.now()
    if (hcpInCache && hcpInCache[0] > now) {
      return hcpInCache[1]
    }
    if (!hcpInCache) {
      console.log(`Cache miss for key ${key} because not in cache`)
    } else {
      console.log(`Cache miss for key ${key} because ${hcpInCache[0]} > ${now}`)
    }
    return null
  }

  /**
   * Ensures the healthcare party has consistent name fields. If lastName/name are set but there is no Official
   * PersonName, one is created. Conversely, if an Official PersonName exists but lastName/name are missing, they
   * are populated from the PersonName.
   * @param hcParty the healthcare party whose names should be completed.
   * @return the healthcare party with completed name fields, or undefined if the input was undefined.
   */
  completeNames(hcParty?: models.HealthcareParty): models.HealthcareParty | undefined {
    if (!hcParty) {
      return hcParty
    }

    let finalHcParty = hcParty

    if ((!!finalHcParty.lastName || !!finalHcParty.name) && !hasName(finalHcParty, models.PersonName.UseEnum.Official)) {
      finalHcParty = garnishPersonWithName(
        finalHcParty,
        models.PersonName.UseEnum.Official,
        finalHcParty.lastName,
        finalHcParty.firstName,
        finalHcParty.name
      )
    }

    if ((!finalHcParty.lastName || !finalHcParty.name) && !!hasName(finalHcParty, models.PersonName.UseEnum.Official)) {
      let officialName = findName(finalHcParty, models.PersonName.UseEnum.Official)
      finalHcParty = {
        ...finalHcParty,
        lastName: officialName!.lastName,
        firstName: officialName!.firstNames ? officialName!.firstNames[0] : undefined,
        name: officialName!.text,
      }
    }

    return finalHcParty
  }

  /**
   * Stores a healthcare party promise in the local cache with a time-to-live.
   * @param key the cache key (typically the healthcare party id).
   * @param hcpPromise the promise resolving to the healthcare party to cache.
   * @return the same promise that was cached.
   */
  putHcPartyInCache(key: string, hcpPromise: Promise<HealthcareParty>): Promise<HealthcareParty> {
    this.hcPartyCache[key] = [Date.now() + this.CACHE_RETENTION_IN_MS, hcpPromise]
    return hcpPromise
  }

  /**
   * Creates a new healthcare party after completing its name fields.
   * @param body the healthcare party to create.
   * @return the created healthcare party.
   */
  createHealthcareParty(body?: HealthcareParty): Promise<HealthcareParty> {
    return super.createHealthcareParty(this.completeNames(body))
  }

  /**
   * Creates a new healthcare party in the specified group after completing its name fields.
   * @param groupId the id of the group in which to create the healthcare party.
   * @param body the healthcare party to create.
   * @return the created healthcare party.
   */
  createHealthcarePartyInGroup(groupId: string, body?: HealthcareParty): Promise<HealthcareParty> {
    return super.createHealthcarePartyInGroup(groupId, this.completeNames(body))
  }

  /**
   * Modifies an existing healthcare party after completing its name fields. Evicts the party from the local cache
   * before modifying, and re-caches the updated version upon success.
   * @param body the healthcare party with updated fields.
   * @return the modified healthcare party.
   */
  modifyHealthcareParty(body?: HealthcareParty): Promise<HealthcareParty | any> {
    if (body && body.id) {
      console.log(`Evict key ${body.id} because of modification`)
      delete this.hcPartyCache[body.id]
    }

    return super.modifyHealthcareParty(this.completeNames(body)).then((hcp) => this.putHcPartyInCache(hcp.id!, Promise.resolve(hcp)))
  }

  /**
   * Retrieves a healthcare party by id. Returns a cached version if available and not expired, otherwise fetches
   * from the server and caches the result.
   * @param healthcarePartyId the id of the healthcare party to retrieve.
   * @param bypassCache if true, skips the cache and fetches directly from the server.
   * @return the healthcare party.
   */
  async getHealthcareParty(healthcarePartyId: string, bypassCache = false): Promise<HealthcareParty | any> {
    const fromCache = bypassCache ? undefined : this.getHcPartyFromCache(healthcarePartyId)
    if (fromCache) {
      try {
        return await fromCache
      } catch {
        if (this.hcPartyCache[healthcarePartyId][1] === fromCache) {
          delete this.hcPartyCache[healthcarePartyId]
        }
        return this.getHealthcareParty(healthcarePartyId, bypassCache)
      }
    } else {
      return await this.putHcPartyInCache(healthcarePartyId, super.getHealthcareParty(healthcarePartyId))
    }
  }

  /**
   * Retrieves the full hierarchy of healthcare party ids, from the topmost parent down to the given party.
   * Recursively walks up the parentId chain.
   * @param healthcarePartyId the id of the healthcare party whose hierarchy to retrieve.
   * @param bypassCache if true, bypasses the cache for each party in the hierarchy.
   * @return an array of healthcare party ids ordered from the topmost ancestor to the given party.
   */
  getHealthcarePartyHierarchyIds(healthcarePartyId: string, bypassCache = false): Promise<string[]> {
    return this.getHealthcareParty(healthcarePartyId, bypassCache).then(async (hcp: HealthcareParty) => {
      return hcp ? (hcp.parentId ? (await this.getHealthcarePartyHierarchyIds(hcp.parentId!, bypassCache)).concat([hcp.id!]) : [hcp.id!]) : []
    })
  }

  /**
   * Retrieves multiple healthcare parties by their ids. Uses the cache where possible, and fetches any missing
   * parties from the server in a single bulk request. Parties not found on the server are filtered out.
   * @param healthcarePartyIds the list of healthcare party ids to retrieve.
   * @return an array of healthcare parties (excluding any that were not found).
   */
  async getHealthcareParties(healthcarePartyIds: ListOfIds): Promise<Array<HealthcareParty> | any> {
    const ids = healthcarePartyIds.ids
    if (!ids || !ids.length) {
      return Promise.resolve([])
    }
    const cached: Array<[string, HealthcareParty | null]> = []
    for (const id of ids) {
      let hcp
      try {
        hcp = await this.getHcPartyFromCache(id)
      } catch {
        hcp = null
        delete this.hcPartyCache[id]
      }
      cached.push([id, hcp])
    }
    const toFetch = cached.filter((x) => !x[1]).map((x) => x[0])

    if (!toFetch.length) {
      return Promise.all(cached.map((x) => x[1]!))
    }

    const prom: Promise<HealthcareParty[]> = super.getHealthcareParties(new ListOfIds({ ids: toFetch }))
    return Promise.all(
      cached.map(
        (x) =>
          x[1] ??
          this.putHcPartyInCache(
            x[0],
            prom.then((hcps) => {
              const hcp = hcps.find((h) => h.id === x[0])
              if (!!hcp) {
                return hcp
              } else {
                throw new Error(`Hcp with id ${x[0]} not found`)
              }
            })
          ).catch((e) => {
            if (e instanceof XHRError) {
              throw e
            }
            return null
          })
      )
    ).then((results) => results.filter((it) => it != null))
  }

  /**
   * Retrieves the currently logged-in healthcare party and caches it.
   * @return the current healthcare party.
   */
  getCurrentHealthcareParty(): Promise<HealthcareParty> {
    return super.getCurrentHealthcareParty().then((hcp) => this.putHcPartyInCache(hcp.id!, Promise.resolve(hcp)))
  }

  /**
   * Validates a Belgian CBE (Crossroads Bank for Enterprises) number using the modulo 97 check.
   * @param cbe the CBE number to validate (non-digit characters are stripped).
   * @return true if the CBE number is valid, false otherwise.
   */
  isValidCbe(cbe: string) {
    cbe = cbe.replace(new RegExp('[^(0-9)]', 'g'), '')
    cbe = cbe.length == 9 ? '0' + cbe : cbe

    return 97 - (Number(cbe.substring(0, 8)) % 97) === Number(cbe.substring(8, 10))
  }

  /**
   * Subscribes to real-time healthcare party events using a WebSocket connection.
   * @param eventTypes the types of events to listen for (e.g. 'CREATE', 'UPDATE', 'DELETE').
   * @param filter an optional filter to restrict which healthcare party events trigger the callback.
   * @param eventFired the callback function invoked when a matching healthcare party event is received.
   * @param options optional subscription configuration such as connection parameters and retry behaviour.
   * @return a connection object that can be used to manage the WebSocket subscription lifecycle.
   */
  async subscribeToHealthcarePartyEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<HealthcareParty> | undefined,
    eventFired: (dataSample: HealthcareParty) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    return subscribeToEntityEvents(this.host, this.authApi, 'HealthcareParty', eventTypes, filter, eventFired, options).then(
      (rs) => new ConnectionImpl(rs)
    )
  }
}
