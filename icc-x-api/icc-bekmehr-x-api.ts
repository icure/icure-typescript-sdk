import * as models from '../icc-api/model/models'
import { IccAuthApi, IccBekmehrApi, IccIcureApi } from '../icc-api'
import { IccContactXApi } from './icc-contact-x-api'
import { IccDocumentXApi } from './icc-document-x-api'
import { IccHelementXApi } from './icc-helement-x-api'
import { string2ua, ua2string } from './utils/binary-utils'
import { Contact, Document, HealthElement, Service } from '../icc-api/model/models'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export type Patcher = ContactPatcher | HealthElementPatcher | DocumentPatcher | ServicePatcher
export interface ContactPatcher {
  type: 'ContactDto'
  patch: (contacts: Contact[]) => Promise<Contact[]>
}
export interface HealthElementPatcher {
  type: 'HealthElementDto'
  patch: (patients: HealthElement[]) => Promise<HealthElement[]>
}
export interface DocumentPatcher {
  type: 'DocumentDto'
  patch: (documents: Document[]) => Promise<Document[]>
}
export interface ServicePatcher {
  type: 'ServiceDto'
  patch: (documents: Service[]) => Promise<Service[]>
}

export class IccBekmehrXApi extends IccBekmehrApi {
  private readonly ctcApi: IccContactXApi
  private readonly helementApi: IccHelementXApi
  private readonly documentApi: IccDocumentXApi
  private readonly wssHost: string
  private readonly authApi: IccAuthApi
  private readonly usesNewKraken: Promise<boolean>

  constructor(
    host: string,
    headers: { [key: string]: string },
    authApi: IccAuthApi,
    ctcApi: IccContactXApi,
    helementApi: IccHelementXApi,
    documentApi: IccDocumentXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.authApi = authApi
    this.ctcApi = ctcApi
    this.helementApi = helementApi
    this.documentApi = documentApi
    this.usesNewKraken = new IccIcureApi(host, headers, new NoAuthenticationProvider(), fetchImpl).getVersion().then((version) => {
      return parseInt(version.split('.')[0]) >= 4
    })

    this.wssHost = new URL(this.host, typeof window !== 'undefined' ? window.location.href : undefined).href
      .replace(/^http/, 'ws')
      .replace(/\/rest\/v.+/, '/ws')
  }

  socketEventListener(
    socket: WebSocket,
    healthcarePartyId: string,
    resolve: (value: Blob) => void,
    reject: (reason?: any) => void,
    patchers: Patcher[],
    progressCallback?: (progress: number) => void
  ) {
    const that = this

    const send = (command: string, uuid: string, body: any) => {
      const data = JSON.stringify({ command, uuid, body })
      socket.send(data.length > 65000 ? string2ua(data).buffer : data)
    }

    const messageHandler = (msg: any, event: any) => {
      if (msg.command === 'decrypt') {
        if (msg.type === 'ContactDto') {
          that.ctcApi
            .decrypt(healthcarePartyId, msg.body)
            .then((res) =>
              patchers
                .filter((p) => p.type === 'ContactDto')
                .reduce(async (p, patcher) => (patcher as ContactPatcher).patch(await p), Promise.resolve(res))
            )
            .then((res) => send('decryptResponse', msg.uuid, res))
        } else if (msg.type === 'HealthElementDto') {
          that.helementApi
            .decrypt(healthcarePartyId, msg.body)
            .then((res) =>
              patchers
                .filter((p) => p.type === 'HealthElementDto')
                .reduce(async (p, patcher) => (patcher as HealthElementPatcher).patch(await p), Promise.resolve(res))
            )
            .then((res) => send('decryptResponse', msg.uuid, res))
        } else if (msg.type === 'DocumentDto') {
          that.documentApi
            .decrypt(
              healthcarePartyId,
              msg.body.map((d: JSON) => new Document(d))
            )
            .then((res) =>
              patchers
                .filter((p) => p.type === 'DocumentDto')
                .reduce(async (p, patcher) => (patcher as DocumentPatcher).patch(await p), Promise.resolve(res))
            )
            .then((res) =>
              send(
                'decryptResponse',
                msg.uuid,
                res?.map((d) => {
                  const de = d.decryptedAttachment
                  const { encryptedAttachment, ...stripped } = d
                  return de ? { ...stripped, decryptedAttachment: btoa(ua2string(de)) } : stripped
                })
              )
            )
        } else if (msg.type === 'ServiceDto') {
          that.ctcApi
            .decryptServices(healthcarePartyId, msg.body)
            .then((res) =>
              patchers
                .filter((p) => p.type === 'ServiceDto')
                .reduce(async (p, patcher) => (patcher as ServicePatcher).patch(await p), Promise.resolve(res))
            )
            .then((res) => send('decryptResponse', msg.uuid, res))
        }
      } else if (msg.command === 'progress') {
        if (progressCallback && msg.body && msg.body[0]) {
          progressCallback(msg.body[0].progress)
        }
      } else {
        console.error('error received from backend:' + event.data)
        reject('websocket error: ' + event.data)
        socket.close(4000, 'backend error')
      }
    }

    return (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data)
        messageHandler(msg, event)
      } else {
        const blob: Blob = event.data
        const subBlob = blob.slice(0, 1)
        const br = new FileReader()
        br.onload = function (e) {
          const firstChar = e.target && new Uint8Array((e.target as any).result as ArrayBuffer)[0]

          if (firstChar === 0x7b) {
            const tr = new FileReader()
            tr.onload = function (e) {
              const msg = e.target && JSON.parse((e.target as any).result as string)
              messageHandler(msg, event)
            }
            tr.readAsBinaryString(blob)
          } else {
            resolve(blob)
            socket.close(1000, 'Ok')
          }
        }
        br.readAsArrayBuffer(subBlob)
      }
    }
  }

  generateSmfExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SoftwareMedicalFileExport,
    progressCallback?: (progress: number) => void,
    sessionId?: string,
    patchers: Patcher[] = []
  ): Promise<Blob | undefined> {
    return this.usesNewKraken
      .then((isNewKraken) => {
        return isNewKraken ? this.authenticationProvider.getAuthService().getAuthHeaders() : null
      })
      .then((authHeaders) => {
        return (!sessionId && !authHeaders ? this.authApi.token('GET', '/ws/be_kmehr/generateSmf') : Promise.resolve('')).then(
          (token) =>
            new Promise<Blob | undefined>((resolve, reject) => {
              const socket = new WebSocket(
                token.length
                  ? `${this.wssHost}/be_kmehr/generateSmf;tokenid=${token}`
                  : `${this.wssHost}/be_kmehr/generateSmf;sessionid=${sessionId ?? ''}`,
                !!authHeaders && authHeaders.length > 0 ? [authHeaders[0].data.replace(' ', '')] : []
              )
              socket.addEventListener('open', function () {
                socket.send(
                  JSON.stringify({
                    parameters: { patientId: patientId, language: language, info: body },
                  })
                )
              })

              // Listen for messages
              socket.addEventListener('message', this.socketEventListener(socket, healthcarePartyId, resolve, reject, patchers, progressCallback))
            })
        )
      })
  }

  generateSumehrExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfo,
    sessionId?: string,
    patchers: Patcher[] = []
  ): Promise<Blob | undefined> {
    return this.usesNewKraken
      .then((isNewKraken) => {
        return isNewKraken ? this.authenticationProvider.getAuthService().getAuthHeaders() : null
      })
      .then((authHeaders) => {
        return (!sessionId && !authHeaders ? this.authApi.token('GET', '/ws/be_kmehr/generateSumehr') : Promise.resolve('')).then(
          (token) =>
            new Promise<Blob | undefined>((resolve, reject) => {
              const socket = new WebSocket(
                token.length
                  ? `${this.wssHost}/be_kmehr/generateSumehr;tokenid=${token}`
                  : `${this.wssHost}/be_kmehr/generateSumehr;sessionid=${sessionId ?? ''}`,
                !!authHeaders && authHeaders.length > 0 ? [authHeaders[0].data.replace(' ', '')] : []
              )
              socket.addEventListener('open', function () {
                socket.send(
                  JSON.stringify({
                    parameters: { patientId: patientId, language: language, info: body },
                  })
                )
              })
              // Listen for messages
              socket.addEventListener('message', this.socketEventListener(socket, healthcarePartyId, resolve, reject, patchers))
            })
        )
      })
  }

  generateSumehrV2ExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfo,
    sessionId?: string,
    patchers: Patcher[] = []
  ): Promise<Blob | undefined> {
    return this.usesNewKraken
      .then((isNewKraken) => {
        return isNewKraken ? this.authenticationProvider.getAuthService().getAuthHeaders() : null
      })
      .then((authHeaders) => {
        return (!sessionId && !authHeaders ? this.authApi.token('GET', '/ws/be_kmehr/generateSumehrV2') : Promise.resolve('')).then(
          (token) =>
            new Promise<Blob | undefined>((resolve, reject) => {
              const socket = new WebSocket(
                token.length
                  ? `${this.wssHost}/be_kmehr/generateSumehrV2;tokenid=${token}`
                  : `${this.wssHost}/be_kmehr/generateSumehrV2;sessionid=${sessionId ?? ''}`,
                !!authHeaders && authHeaders.length > 0 ? [authHeaders[0].data.replace(' ', '')] : []
              )
              socket.addEventListener('open', function () {
                socket.send(
                  JSON.stringify({
                    parameters: { patientId: patientId, language: language, info: body },
                  })
                )
              })
              // Listen for messages
              socket.addEventListener('message', this.socketEventListener(socket, healthcarePartyId, resolve, reject, patchers))
            })
        )
      })
  }

  generateDiaryNoteExportWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    body: models.SumehrExportInfo,
    sessionId?: string,
    patchers: Patcher[] = []
  ): Promise<Blob | undefined> {
    return this.usesNewKraken
      .then((isNewKraken) => {
        console.log(isNewKraken)
        return isNewKraken ? this.authenticationProvider.getAuthService().getAuthHeaders() : null
      })
      .then((authHeaders) => {
        return (!sessionId && !authHeaders ? this.authApi.token('GET', '/ws/be_kmehr/generateDiaryNote') : Promise.resolve('')).then(
          (token) =>
            new Promise<Blob | undefined>((resolve, reject) => {
              const socket = new WebSocket(
                token.length
                  ? `${this.wssHost}/be_kmehr/generateDiaryNote;tokenid=${token}`
                  : `${this.wssHost}/be_kmehr/generateDiaryNote;sessionid=${sessionId ?? ''}`,
                !!authHeaders && authHeaders.length > 0 ? [authHeaders[0].data.replace(' ', '')] : []
              )
              socket.addEventListener('open', function () {
                socket.send(
                  JSON.stringify({
                    parameters: { patientId: patientId, language: language, info: body },
                  })
                )
              })
              // Listen for messages
              socket.addEventListener('message', this.socketEventListener(socket, healthcarePartyId, resolve, reject, patchers))
            })
        )
      })
  }

  generateMedicationSchemeWithEncryptionSupport(
    patientId: string,
    healthcarePartyId: string,
    language: string,
    recipientSafe: string,
    version: number,
    body: models.MedicationSchemeExportInfo,
    sessionId?: string,
    patchers: Patcher[] = []
  ): Promise<Blob | undefined> {
    return this.usesNewKraken
      .then((isNewKraken) => {
        return isNewKraken ? this.authenticationProvider.getAuthService().getAuthHeaders() : null
      })
      .then((authHeaders) => {
        return (!sessionId && !authHeaders ? this.authApi.token('GET', '/ws/be_kmehr/generateMedicationScheme') : Promise.resolve('')).then(
          (token) =>
            new Promise<Blob | undefined>((resolve, reject) => {
              const socket = new WebSocket(
                token.length
                  ? `${this.wssHost}/be_kmehr/generateMedicationScheme;tokenid=${token}`
                  : `${this.wssHost}/be_kmehr/generateMedicationScheme;sessionid=${sessionId ?? ''}`,
                !!authHeaders && authHeaders.length > 0 ? [authHeaders[0].data.replace(' ', '')] : []
              )
              socket.addEventListener('open', function () {
                socket.send(
                  JSON.stringify({
                    parameters: {
                      patientId: patientId,
                      language: language,
                      recipientSafe: recipientSafe,
                      version: version,
                      info: body,
                    },
                  })
                )
              })
              // Listen for messages
              socket.addEventListener('message', this.socketEventListener(socket, healthcarePartyId, resolve, reject, patchers))
            })
        )
      })
  }
}
