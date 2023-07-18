import {IccAuthApi, IccDeviceApi} from '../icc-api'
import {Device} from '../icc-api/model/Device'
import {AuthenticationProvider, NoAuthenticationProvider} from './auth/AuthenticationProvider'
import {AbstractFilter} from "./filters/filters"
import {Connection, ConnectionImpl} from "../icc-api/model/Connection"
import {subscribeToEntityEvents} from "./utils/websocket"
import {IccUserXApi} from "./icc-user-x-api"

// noinspection JSUnusedGlobalSymbols
export class IccDeviceXApi extends IccDeviceApi {
  private readonly userApi: IccUserXApi
  private readonly icureBasePath: string
  private readonly authApi: IccAuthApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    userApi: IccUserXApi,
    icureBasePath: string,
    authApi: IccAuthApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
        ? self.fetch
        : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)

    this.userApi = userApi
    this.icureBasePath = icureBasePath
    this.authApi = authApi
  }

  async subscribeToDeviceEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<Device> | undefined,
    eventFired: (dataSample: Device) => Promise<void>,
    options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number } = {}
  ): Promise<Connection> {
    return subscribeToEntityEvents(
      this.icureBasePath,
      this.authApi,
      'Device',
      eventTypes,
      filter,
      eventFired,
      options,
    ).then((rs) => new ConnectionImpl(rs))
  }
}
