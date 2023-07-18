import * as WebSocketNode from 'ws'
import log, {LogLevelDesc} from 'loglevel'
import {Patient} from "../../icc-api/model/Patient"
import {AbstractFilter} from "../filters/filters"
import {User} from "../../icc-api/model/User"
import {iccRestApiPath} from "../../icc-api/api/IccRestApiPath"
import {isNode} from "browser-or-node"
import {IccAuthApi} from "../../icc-api"
import {Service} from "../../icc-api/model/Service"
import {HealthElement} from "../../icc-api/model/HealthElement"
import {MaintenanceTask} from "../../icc-api/model/MaintenanceTask"
import {HealthcareParty} from "../../icc-api/model/HealthcareParty"
import {Device} from "../../icc-api/model/Device"

export type EventTypes = 'CREATE' | 'UPDATE' | 'DELETE'
type Subscribable = 'Patient' | 'Service' | 'User' | 'HealthElement' | 'MaintenanceTask' | 'HealthcareParty' | 'Device'

log.setLevel((process.env.WEBSOCKET_LOG_LEVEL as LogLevelDesc) ?? 'info')

export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Patient',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Patient> | undefined,
  eventFired: (entity: Patient) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
  decryptor: (encrypted: Patient) => Promise<Patient>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Service',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Service> | undefined,
  eventFired: (entity: Service) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
  decryptor: (encrypted: Service) => Promise<Service>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'HealthElement',
  eventTypes: EventTypes[],
  filter: AbstractFilter<HealthElement> | undefined,
  eventFired: (entity: HealthElement) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
  decryptor: (encrypted: HealthElement) => Promise<HealthElement>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'User',
  eventTypes: EventTypes[],
  filter: AbstractFilter<User> | undefined,
  eventFired: (entity: User) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number }
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'MaintenanceTask',
  eventTypes: EventTypes[],
  filter: AbstractFilter<MaintenanceTask> | undefined,
  eventFired: (entity: MaintenanceTask) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
  decryptor: (encrypted: MaintenanceTask) => Promise<MaintenanceTask>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'HealthcareParty',
  eventTypes: EventTypes[],
  filter: AbstractFilter<HealthcareParty> | undefined,
  eventFired: (entity: HealthcareParty) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Device',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Device> | undefined,
  eventFired: (entity: Device) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number },
): Promise<WebSocketWrapper>

export function subscribeToEntityEvents<T extends Patient | Service | HealthElement | MaintenanceTask | HealthcareParty | Device>(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: Subscribable,
  eventTypes: EventTypes[],
  filter: AbstractFilter<T> | undefined,
  eventFired: (entity: T) => Promise<void>,
  options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number } = {},
  decryptor?: (encrypted: T) => Promise<T>
): Promise<WebSocketWrapper> {
  const config = {
    User: {
      qualifiedName: 'org.taktik.icure.entities.User',
      decryptor: (data: User) => Promise.resolve(data as T),
    },
    Patient: {
      qualifiedName: 'org.taktik.icure.entities.Patient',
      decryptor: (data: Patient) => decryptor!(data as Patient as T),
    },
    Service: {
      qualifiedName: 'org.taktik.icure.entities.embed.Service',
      decryptor: (data: Service) => decryptor!(data as Service as T),
    },
    HealthElement: {
      qualifiedName: 'org.taktik.icure.entities.HealthElement',
      decryptor: (data: HealthElement) =>
        decryptor!(data as HealthElement as T),
    },
    MaintenanceTask: {
      qualifiedName: 'org.taktik.icure.entities.MaintenanceTask',
      decryptor: (data: MaintenanceTask) =>
        decryptor!(data as MaintenanceTask as T),
    },
    HealthcareParty: {
      qualifiedName: 'org.taktik.icure.entities.HealthcareParty',
      decryptor: (data: HealthcareParty) =>
        Promise.resolve(data as HealthcareParty as T),
    },
    Device: {
      qualifiedName: 'org.taktik.icure.entities.Device',
      decryptor: (data: Device) =>
        Promise.resolve(data as Device as T),
    }
  }

  return WebSocketWrapper.create(
    iccRestApiPath(basePath).replace('http', 'ws').replace('rest', 'ws') + '/notification/subscribe',
    new WebSocketAuthProviderImpl(authApi),
    options.connectionMaxRetry ?? 5,
    options.connectionRetryIntervalMs ?? 1_000,
    {
      CONNECTED: [
        async (ws: WebSocketWrapper) => {
          const subscription = {
            eventTypes,
            entityClass: config[entityClass].qualifiedName,
            filter: filter
          }

          ws.send(JSON.stringify(subscription))
        },
      ],
    },
    async (data: any) => {
      try {
        await config[entityClass].decryptor(data).then((o) => eventFired(o))
      } catch (e) {
        log.error(e)
      }
    }
  )
}

export type ConnectionStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'CLOSED' | 'ERROR'
export type StatusCallback = (ws: WebSocketWrapper) => void
export type ErrorStatusCallback = (ws: WebSocketWrapper, error?: Error) => void
export type ConnectionStatusFunction = {
  [K in ConnectionStatus]: K extends 'ERROR' ? ErrorStatusCallback : StatusCallback
}
export type ConnectionStatusFunctions = {
  [K in ConnectionStatus]?: K extends 'ERROR' ? Array<ErrorStatusCallback> : Array<StatusCallback>
}
export type WebSocketWrapperMessageCallback = (data: any) => void

export class WebSocketWrapper {
  private readonly pingLifetime: number = 20_000
  private socket: WebSocketNode | WebSocket | null = null
  private retries = 0
  private closed = false
  private lastPingReceived = Date.now()
  private intervalIds: (NodeJS.Timeout | number)[] = []
  private readonly methodPath: string

  private constructor(
    private readonly url: string,
    private readonly authProvider: WebSocketAuthProvider,
    private readonly maxRetries = 3,
    private readonly retryDelay = 1000,
    private readonly statusCallbacks: ConnectionStatusFunctions = {},
    private readonly messageCallback: WebSocketWrapperMessageCallback = () => {
    }
  ) {
    this.methodPath = new URL(url).pathname
  }

  public static async create(
    url: string,
    authProvider: WebSocketAuthProvider,
    maxRetries?: number,
    retryDelay?: number,
    statusCallbacks?: ConnectionStatusFunctions,
    messageCallback?: WebSocketWrapperMessageCallback
  ): Promise<WebSocketWrapper> {
    const ws = new WebSocketWrapper(url, authProvider, maxRetries, retryDelay, statusCallbacks, messageCallback)
    await ws.connect()
    return ws
  }

  public send(data: Buffer | ArrayBuffer | string) {
    if (this.socket && this.socket.readyState === WebSocketNode.OPEN) {
      this.socket.send(data)
    }
  }

  public close() {
    if (this.socket) {
      this.closed = true
      this.socket.close(1001, 'Client closed connection')
    }
  }

  public addStatusCallback(status: ConnectionStatus, callback: ConnectionStatusFunction[ConnectionStatus]) {
    switch (status) {
      case 'CONNECTED':
      case 'CLOSED':
        if (!this.statusCallbacks[status]) this.statusCallbacks[status] = []
        this.statusCallbacks?.[status]?.push(callback)
        break
      case 'ERROR':
        this.statusCallbacks?.ERROR?.push(callback)
        break
    }
  }

  private async connect() {
    if (this.retries >= this.maxRetries) {
      throw new Error('WebSocket connection failed after ' + this.maxRetries + ' retries')
    }

    const bearerToken = await this.authProvider.getBearerToken()

    if (isNode) {
      const socket: WebSocketNode = !!bearerToken
        ? new WebSocketNode(this.url, {
          headers: {
            Authorization: bearerToken,
          },
        })
        : await this.authProvider.getIcureOtt(this.methodPath).then((icureOttToken) => new WebSocketNode(`${this.url};tokenid=${icureOttToken}`))
      this.socket = socket

      socket.on('open', async () => {
        log.debug('WebSocket connection opened')

        this.intervalIds.push(
          setTimeout(() => {
            this.retries = 0
          }, (this.maxRetries + 1) * this.retryDelay)
        )

        this.callStatusCallbacks('CONNECTED')
      })

      socket.on('message', (event: Buffer) => {
        log.debug('WebSocket message received', event)

        const dataAsString = event.toString('utf8')

        // Handle ping messages
        if (dataAsString === 'ping') {
          log.debug('Received ping, sending pong')

          this.send('pong')
          this.lastPingReceived = Date.now()

          this.intervalIds.push(
            setTimeout(() => {
              if (Date.now() - this.lastPingReceived > this.pingLifetime) {
                log.error(`No ping received in the last ${this.pingLifetime} ms`)
                this.socket?.close()
              }
            }, this.pingLifetime)
          )

          return
        }

        // Call the message callback for other messages
        try {
          const data = JSON.parse(dataAsString)
          this.messageCallback(data)
        } catch (error) {
          log.error('Failed to parse WebSocket message', error)
        }
      })

      socket.on('close', (code, reason) => {
        log.debug('WebSocket connection closed', code, reason.toString('utf8'))

        this.callStatusCallbacks('CLOSED')

        this.intervalIds.forEach((id) => clearTimeout(id as number))
        this.intervalIds = []

        if (this.closed) {
          return
        }

        setTimeout(async () => {
          ++this.retries
          return await this.connect()
        }, this.retryDelay)
      })

      socket.on('error', async (err) => {
        log.error('WebSocket error', err)

        this.callStatusCallbacks('ERROR', err)

        if (this.socket) {
          this.socket.close()
        }
      })
    } else {
      throw new Error('Subscription api is not yet supported in browser')
      // TODO implement browser version
    }
  }

  private callStatusCallbacks(event: ConnectionStatus, error?: Error) {
    switch (event) {
      case 'CONNECTED':
      case 'CLOSED':
        this.statusCallbacks?.[event]?.forEach((callback) => callback(this))
        break
      case 'ERROR':
        this.statusCallbacks?.ERROR?.forEach((callback) => callback(this, error))
        break
    }
  }
}

interface WebSocketAuthProvider {
  getBearerToken(): Promise<string | undefined>

  getIcureOtt(icureMethodPath: string): Promise<string>
}

class WebSocketAuthProviderImpl {
  constructor(private readonly authApi: IccAuthApi) {
  }

  async getBearerToken(): Promise<string | undefined> {
    const headers = await this.authApi.authenticationProvider.getAuthService().getAuthHeaders()
    return headers.find((header) => header.header === 'Authorization' && header.data.startsWith('Bearer '))?.data
  }

  async getIcureOtt(icureMethodPath: string): Promise<string> {
    return await this.authApi.token('GET', icureMethodPath)
  }
}
