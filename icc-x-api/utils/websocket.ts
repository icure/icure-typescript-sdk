import * as WebSocketNode from 'ws'
import log, {LogLevelDesc} from 'loglevel'
import {Patient} from "../../icc-api/model/Patient"
import {AbstractFilter} from "../filters/filters"
import {User} from "../../icc-api/model/User"
import {isBrowser, isNode} from "browser-or-node"
import {IccAuthApi} from "../../icc-api"
import {Service} from "../../icc-api/model/Service"
import {HealthElement} from "../../icc-api/model/HealthElement"
import {MaintenanceTask} from "../../icc-api/model/MaintenanceTask"
import {HealthcareParty} from "../../icc-api/model/HealthcareParty"
import {Device} from "../../icc-api/model/Device"
import {Contact} from "../../icc-api/model/Contact"

export type EventTypes = 'CREATE' | 'UPDATE' | 'DELETE'
type Subscribable = 'Patient' | 'Service' | 'User' | 'HealthElement' | 'MaintenanceTask' | 'HealthcareParty' | 'Device' | 'Contact'
type SubscribableEntity = Patient | Service | User | HealthElement | MaintenanceTask | HealthcareParty | Device | Contact
type SubscriptionOptions = {
  connectionMaxRetry?: number
  connectionRetryIntervalMs?: number
}

log.setLevel((process.env.WEBSOCKET_LOG_LEVEL as LogLevelDesc) ?? 'info')

export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Patient',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Patient> | undefined,
  eventFired: (entity: Patient) => Promise<void>,
  options: SubscriptionOptions,
  decryptor: (encrypted: Patient) => Promise<Patient>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Service',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Service> | undefined,
  eventFired: (entity: Service) => Promise<void>,
  options: SubscriptionOptions,
  decryptor: (encrypted: Service) => Promise<Service>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Contact',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Contact> | undefined,
  eventFired: (entity: Contact) => Promise<void>,
  options: SubscriptionOptions,
  decryptor: (encrypted: Service) => Promise<Service>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'HealthElement',
  eventTypes: EventTypes[],
  filter: AbstractFilter<HealthElement> | undefined,
  eventFired: (entity: HealthElement) => Promise<void>,
  options: SubscriptionOptions,
  decryptor: (encrypted: HealthElement) => Promise<HealthElement>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'User',
  eventTypes: EventTypes[],
  filter: AbstractFilter<User> | undefined,
  eventFired: (entity: User) => Promise<void>,
  options: SubscriptionOptions
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'MaintenanceTask',
  eventTypes: EventTypes[],
  filter: AbstractFilter<MaintenanceTask> | undefined,
  eventFired: (entity: MaintenanceTask) => Promise<void>,
  options: SubscriptionOptions,
  decryptor: (encrypted: MaintenanceTask) => Promise<MaintenanceTask>
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'HealthcareParty',
  eventTypes: EventTypes[],
  filter: AbstractFilter<HealthcareParty> | undefined,
  eventFired: (entity: HealthcareParty) => Promise<void>,
  options: SubscriptionOptions,
): Promise<WebSocketWrapper>
export function subscribeToEntityEvents(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: 'Device',
  eventTypes: EventTypes[],
  filter: AbstractFilter<Device> | undefined,
  eventFired: (entity: Device) => Promise<void>,
  options: SubscriptionOptions,
): Promise<WebSocketWrapper>

export function subscribeToEntityEvents<T extends SubscribableEntity>(
  basePath: string,
  authApi: IccAuthApi,
  entityClass: Subscribable,
  eventTypes: EventTypes[],
  filter: AbstractFilter<T> | undefined,
  eventFired: (entity: T) => Promise<void>,
  options: SubscriptionOptions = {},
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
    },
    Contact: {
      qualifiedName: 'org.taktik.icure.entities.Contact',
      decryptor: (data: Contact) => decryptor!(data as Contact as T),
    },
  }

  return WebSocketWrapper.create(
    basePath.replace('http', 'ws').replace('rest', 'ws') + '/notification/subscribe',
    new WebSocketAuthProviderImpl(authApi),
    options.connectionMaxRetry ?? 5,
    options.connectionRetryIntervalMs ?? 1_000,
    {
      CONNECTED: [
        async (ws: WebSocketWrapper) => {
          const subscription = {
            eventTypes,
            entityClass: config[entityClass].qualifiedName,
            filter: {filter}
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
  private socket: WebsocketAdapter | null = null
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
    if (this.socket && this.socket.readyState === ReadyState.OPEN) {
      this.socket.send(data)
    }
  }

  public close() {
    if (this.socket) {
      this.closed = true
      this.socket.close(1000, 'Client closed connection')
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

    const socket = isNode && !!bearerToken ? new WebSocketNode(this.url, {
        headers: {
          Authorization: bearerToken,
        },
      })
      : await this.authProvider.getIcureOtt(this.methodPath).then((icureOttToken) => {
        const address = `${this.url};tokenid=${icureOttToken}`
        return isNode ? new WebSocketNode(address) : new WebSocket(address)
      })

    this.socket = new WebsocketAdapter(socket)

    this.socket.on('open', async () => {
      log.debug('WebSocket connection opened')

      this.intervalIds.push(
        setTimeout(() => {
          this.retries = 0
        }, (this.maxRetries + 1) * this.retryDelay)
      )

      this.callStatusCallbacks('CONNECTED')
    })

    this.socket.on('message', (event: string) => {
      log.debug('WebSocket message received', event)

      // Handle ping messages
      if (event === 'ping') {
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
        const data = JSON.parse(event)
        this.messageCallback(data)
      } catch (error) {
        log.error('Failed to parse WebSocket message', error)
      }
    })

    this.socket.on('close', ({code, reason}) => {
      log.debug('WebSocket connection closed', code, reason?.toString())

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

    this.socket.on('error', async (err) => {
      log.error('WebSocket error', err)

      this.callStatusCallbacks('ERROR', err)

      if (this.socket) {
        this.socket.close()
      }
    })
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

type EventCallback = {
  open: (event: any) => void,
  message: (event: string) => void,
  close: (event: {code: number, reason: string}) => void,
  error: (error: any) => void
}

enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

class WebsocketAdapter {
  constructor(
    private readonly websocket: WebSocketNode | WebSocket,
  ) {
  }

  public get readyState(): number {
    if (this.websocket) {
      if (isNode) {
        switch ((this.websocket as WebSocketNode).readyState) {
          case WebSocketNode.CONNECTING:
            return ReadyState.CONNECTING
          case WebSocketNode.OPEN:
            return ReadyState.OPEN
          case WebSocketNode.CLOSING:
            return ReadyState.CLOSING
          case WebSocketNode.CLOSED:
            return ReadyState.CLOSED
        }
      } else {
        switch ((this.websocket as WebSocket).readyState) {
          case WebSocket.CONNECTING:
            return ReadyState.CONNECTING
          case WebSocket.OPEN:
            return ReadyState.OPEN
          case WebSocket.CLOSING:
            return ReadyState.CLOSING
          case WebSocket.CLOSED:
            return ReadyState.CLOSED
        }
      }
    }
    return ReadyState.CLOSED
  }

  /**
   * This is not throwing an error if the websocket is not open, because the purpose of the websocket wrapper is custom to notifications needs (subscribe and ping pong only)
   * If in the future we need to use it for other purposes, we will have to throw an error and update the implementation of ping pong in the notification
   * @param data the data to send
   */
  public send(data: Buffer | ArrayBuffer | string) {
    if (this.websocket && this.readyState === ReadyState.OPEN) {
      this.websocket.send(data)
    }
  }

  public close(code?: number, reason?: string) {
    if (this.websocket) {
      this.websocket.close(code, reason)
    }
  }

   private onMessage(callback: (event: string) => void) {
    if (this.websocket) {
      if (isNode) {
        (this.websocket as WebSocketNode).on('message', (x) => callback(x.toString('utf8')))
      } else {
        (this.websocket as WebSocket).addEventListener('message', async (event) => {
          let dataAsString: string | undefined
          if (event.type === 'message') {
            dataAsString = event.data
          } else log.error("Unexpected event type: " + event.type)
          if (!dataAsString) {
            log.error("Failed to parse WebSocket message")
            return
          }

          callback(dataAsString)
        })
      }
    }
    else {
      log.error("Websocket is not defined")
      throw new Error('Websocket is not defined')
    }
  }

  private onOpen(callback: (event: any) => void) {
    if (this.websocket) {
      if (isNode) {
        (this.websocket as WebSocketNode).on('open', callback)
      } else {
        (this.websocket as WebSocket).addEventListener('open', callback)
      }
    }
  }

  private onClose(callback: (event: {code: number, reason: string}) => void) {
    if (this.websocket) {
      if (isNode) {
        (this.websocket as WebSocketNode).on('close', callback)
      } else {
        (this.websocket as WebSocket).addEventListener('close', callback)
      }
    }
  }

  private onError(callback: (error: any) => void) {
    if (this.websocket) {
      if (isNode) {
        (this.websocket as WebSocketNode).on('error', callback)
      } else {
        (this.websocket as WebSocket).addEventListener('error', callback)
      }
    }
  }


  public on<K extends keyof EventCallback>(event: K, callback: EventCallback[K]) {
    if (this.websocket) {
      switch (event) {
        case 'message':
          return this.onMessage(callback as EventCallback['message'])
        case 'open':
          return this.onOpen(callback as EventCallback['open'])
        case 'close':
          return this.onClose(callback as EventCallback['close'])
        case 'error':
          return this.onError(callback as EventCallback['error'])
      }
    }
  }
}
