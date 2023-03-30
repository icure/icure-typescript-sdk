import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccReceiptXApi extends IccReceiptApi {
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Creates a new instance of receipt with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param r initialised data for the receipt. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the receipt other than the current data owner.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of receipt.
   */
  async newInstance(user: models.User, r: any, delegates: string[] = [], delegationTags?: string[]): Promise<models.Receipt> {
    const receipt = new models.Receipt(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.Receipt',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
          author: user.id,
          codes: [],
          tags: [],
        },
        r || {}
      )
    )

    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new models.Receipt(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(receipt, undefined, undefined, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }

  logReceipt(user: models.User, docId: string, refs: Array<string>, blobType: string, blob: ArrayBuffer) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then((rcpt) => this.createReceipt(rcpt))
      .then((rcpt) => (blob.byteLength != 0 ? this.setReceiptAttachmentForBlobType(rcpt.id!, rcpt.rev!, blobType, <any>blob) : Promise.resolve(rcpt)))
  }

  /**
   * Adds an attachment to a receipt, encrypting it on client side using the encryption keys of the provided receipt.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment a attachment for the receipt.
   * @return the updated receipt.
   */
  async encryptAndSetReceiptAttachment(receipt: models.Receipt, blobType: string, attachment: ArrayBuffer | Uint8Array): Promise<models.Receipt> {
    const encryptedData = await this.crypto.entities.encryptDataOf(receipt, attachment, 'Receipt')
    return await this.setReceiptAttachmentForBlobType(receipt.id!, receipt.rev!, blobType, encryptedData)
  }

  /**
   * Gets the attachment of a receipt and tries to decrypt it using the encryption keys of the receipt.
   * @param receipt a receipt.
   * @param attachmentId id of the attachment of this receipt to retrieve.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the receipt has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return the decrypted attachment, if it could be decrypted, else the encrypted attachment.
   */
  async getAndDecryptReceiptAttachment(
    receipt: models.Receipt,
    attachmentId: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    return await this.crypto.entities.decryptDataOf(receipt, await this.getReceiptAttachment(receipt.id!, attachmentId), 'Receipt', (x) =>
      validator(x)
    )
  }
}
