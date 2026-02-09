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

  /**
   * Creates a new instance of document template with initialised metadata (not persisted in the database).
   * @param user the current user, used to set the owner.
   * @param template the template content as a string, which will be converted to an ArrayBuffer attachment.
   * @param c optional initial data to merge into the document template. Metadata such as id, creation date, and guid
   * will be automatically generated if not provided.
   * @return a new DocumentTemplate instance with populated metadata fields.
   */
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

  /**
   * @deprecated not implemented. Always rejects with an error.
   * @param ownerId the id of the owner.
   * @return always rejects.
   */
  // noinspection JSUnusedLocalSymbols
  findAllByOwnerId(ownerId: string): Promise<Array<models.DocumentTemplate>> {
    return new Promise(function (resolve, reject) {
      reject(console.log('findByHCPartyPatientSecretFKeys not implemented in document API!'))
    })
  }

  /**
   * Builds the URL for downloading a document template attachment.
   * @param documentId the id of the document template.
   * @param attachmentId the id of the attachment.
   * @return the fully qualified URL to the attachment resource.
   */
  // noinspection JSUnusedGlobalSymbols
  getAttachmentUrl(documentId: string, attachmentId: string) {
    return (
      this.host + '/doctemplate/{documentId}/attachment/{attachmentId}'.replace('{documentId}', documentId).replace('{attachmentId}', attachmentId)
    )
  }

  /**
   * Retrieves the text content of a document template attachment. Decodes binary responses as UTF-8 text, and
   * returns text/plain, text/html, or text/xml content directly. Returns false for unsupported content types.
   * @param documentTemplateId the id of the document template.
   * @param attachmentId the id of the attachment.
   * @return the attachment text content as a string, or false if the content type is unsupported.
   */
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
