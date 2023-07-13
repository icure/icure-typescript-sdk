import { IccDoctemplateApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import { extend } from 'lodash'
import * as models from '../icc-api/model/models'
import { DocumentTemplate } from '../icc-api/model/models'
import { string2ua } from './utils/binary-utils'
import { XHR } from '../icc-api/api/XHR'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

// noinspection JSUnusedGlobalSymbols
export class IccDoctemplateXApi extends IccDoctemplateApi {
  crypto: IccCryptoXApi
  authenticationProvider: AuthenticationProvider
  fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.authenticationProvider = authenticationProvider
    this.fetchImpl = fetchImpl
  }

  newInstance(user: models.User, template: string, c: any): Promise<DocumentTemplate> {
    return new Promise<DocumentTemplate>((resolve, reject) => {
      const documentTemplate: DocumentTemplate = {
        ...(c ?? {}),
        _type: 'org.taktik.icure.entities.DocumentTemplate',
        id: c?.id ?? this.crypto.primitives.randomUuid(),
        owner: c?.owner ?? user.id,
        created: c?.created ?? new Date().getTime(),
        modified: c?.modified ?? new Date().getTime(),
        guid: c?.guid ?? this.crypto.primitives.randomUuid(),
        group: c?.group ?? null,
        specialty: c?.specialty ?? null,
        attachment: c?.attachment ?? string2ua(template),
        mainUti: c?.mainUti ?? 'public.plain-text',
      }
      if (documentTemplate.group && documentTemplate.group.guid == null) {
        documentTemplate.group.guid = this.crypto.primitives.randomUuid()
      }

      //sauver l doctemplate vide

      if (template) {
        //save attachement
      }

      return resolve(documentTemplate)
    })
  }

  // noinspection JSUnusedLocalSymbols
  findAllByOwnerId(ownerId: string): Promise<Array<models.DocumentTemplate>> {
    return new Promise(function (resolve, reject) {
      reject(console.log('findByHCPartyPatientSecretFKeys not implemented in document API!'))
    })
  }

  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId: string, attachmentId: string) {
    return (
      this.host + '/doctemplate/{documentId}/attachment/{attachmentId}'.replace('{documentId}', documentId).replace('{attachmentId}', attachmentId)
    )
  }

  getAttachmentText(documentTemplateId: string, attachmentId: string): Promise<any | boolean> {
    const _body = null

    const _url =
      this.host +
      '/doctemplate/{documentTemplateId}/attachmentText/{attachmentId}'
        .replace('{documentTemplateId}', documentTemplateId + '')
        .replace('{attachmentId}', attachmentId + '') +
      '?ts=' +
      new Date().getTime()

    return XHR.sendCommand('GET', _url, this.headers, _body, this.fetchImpl, undefined, this.authenticationProvider.getAuthService())
      .then((doc) => {
        if (doc.contentType.startsWith('application/octet-stream')) {
          const enc = new TextDecoder('utf-8')
          const arr = new Uint8Array(doc.body)
          return enc.decode(arr)
        } else if (doc.contentType.startsWith('text/plain') || doc.contentType.startsWith('text/html') || doc.contentType.startsWith('text/xml')) {
          return doc.body
        } else {
          return false
        }
      })
      .catch((err) => this.handleError(err))
  }
}
