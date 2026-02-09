import {IccAuthApi, IccDeviceApi} from '../icc-api'
import {Device} from '../icc-api/model/Device'
import {AuthenticationProvider, NoAuthenticationProvider} from './auth/AuthenticationProvider'
import {AbstractFilter} from "./filters/filters"
import {Connection, ConnectionImpl} from "../icc-api/model/Connection"
import {subscribeToEntityEvents, SubscriptionOptions} from "./utils/websocket"
import {IccUserXApi} from "./icc-user-x-api"

// noinspection JSUnusedGlobalSymbols
export class IccDeviceXApi extends IccDeviceApi {
  private readonly userApi: IccUserXApi
  private readonly authApi: IccAuthApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    userApi: IccUserXApi,
    authApi: IccAuthApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
        ? self.fetch
        : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)

    this.userApi = userApi
    this.authApi = authApi
  }

  /**
   * Subscribes to real-time device events using a WebSocket connection.
   * @param eventTypes the types of events to listen for (e.g. 'CREATE', 'UPDATE', 'DELETE').
   * @param filter an optional filter to restrict which device events trigger the callback.
   * @param eventFired the callback function invoked when a matching device event is received.
   * @param options optional subscription configuration such as connection parameters and retry behaviour.
   * @return a connection object that can be used to manage the WebSocket subscription lifecycle.
   */
  async subscribeToDeviceEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<Device> | undefined,
    eventFired: (dataSample: Device) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    return subscribeToEntityEvents(
      this.host,
      this.authApi,
      'Device',
      eventTypes,
      filter,
      eventFired,
      options,
    ).then((rs) => new ConnectionImpl(rs))
  }
}
