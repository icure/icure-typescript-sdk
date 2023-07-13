import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

export class IccReceiptXApi extends IccReceiptApi implements EncryptedEntityXApi<models.Receipt> {
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
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * @return a new instance of receipt.
   */
  async newInstance(
    user: models.User,
    r: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
    } = {}
  ): Promise<models.Receipt> {
    const receipt = new models.Receipt({
      ...(r ?? {}),
      _type: 'org.taktik.icure.entities.Receipt',
      id: r?.id ?? this.crypto.randomUuid(),
      created: r?.created ?? new Date().getTime(),
      modified: r?.modified ?? new Date().getTime(),
      responsible: r?.responsible ?? this.dataOwnerApi.getDataOwnerIdOf(user),
      author: r?.author ?? user.id,
      codes: r?.codes ?? [],
      tags: r?.tags ?? [],
    })

    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(user.autoDelegations?.all ?? []),
      ...(user.autoDelegations?.medicalInformation ?? []),
    ]
    return new models.Receipt(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(receipt, undefined, undefined, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  logReceipt(user: models.User, docId: string, refs: Array<string>, blobType: string, blob: ArrayBuffer) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then((rcpt) => this.createReceipt(rcpt))
      .then((rcpt) => (blob.byteLength != 0 ? this.setReceiptAttachment(rcpt.id!, blobType, '', <any>blob) : Promise.resolve(rcpt)))
  }

  /**
   * Adds an attachment to a receipt, encrypting it on client side using the encryption keys of the provided receipt.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment a attachment for the receipt.
   * @return the updated receipt.
   */
  async encryptAndSetReceiptAttachment(receipt: models.Receipt, blobType: string, attachment: ArrayBuffer | Uint8Array): Promise<models.Receipt> {
    const encryptedData = await this.crypto.entities.encryptDataOf(receipt, attachment)
    return await this.setReceiptAttachment(receipt.id!, blobType, undefined, encryptedData)
  }

  /**
   * Adds an unencrypted attachment to a receipt.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment a attachment for the receipt.
   * @return the updated receipt.
   */
  async setClearReceiptAttachment(receipt: models.Receipt, blobType: string, attachment: ArrayBuffer | Uint8Array): Promise<models.Receipt> {
    return await this.setReceiptAttachment(receipt.id!, blobType, undefined, attachment)
  }

  /**
   * Gets the attachment of a receipt and tries to decrypt it using the encryption keys of the receipt, throwing an error if the operation fails.
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
    const { data, wasDecrypted } = await this.crypto.entities.tryDecryptDataOf(
      receipt,
      await this.getReceiptAttachment(receipt.id!, attachmentId, ''),
      (x) => validator(x)
    )
    if (!wasDecrypted) throw new Error(`No valid key found to decrypt data of receipt ${receipt.id}.`)
    return data
  }

  /**
   * Gets the attachment of a receipt and tries to decrypt it using the encryption keys of the receipt.
   * @param receipt a receipt.
   * @param attachmentId id of the attachment of this receipt to retrieve.
   * @param validator optionally a validator function which checks if the decryption was successful. In cases where the receipt has many encryption
   * keys and it is unclear which one should be used this function can help to detect bad decryptions.
   * @return an object containing:
   * - data: the decrypted attachment, if it could be decrypted, else the encrypted attachment.
   * - wasDecrypted: if the data was successfully decrypted or not
   */
  async getAndTryDecryptReceiptAttachment(
    receipt: models.Receipt,
    attachmentId: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    return await this.crypto.entities.tryDecryptDataOf(receipt, await this.getReceiptAttachment(receipt.id!, attachmentId, ''), (x) => validator(x))
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the receipt.
   * @param receipt the receipt to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * receipt does not have encrypted content.
   * @return a promise which will contain the updated receipt.
   */
  async shareWith(
    delegateId: string,
    receipt: models.Receipt,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Receipt> {
    return this.shareWithMany(receipt, { [delegateId]: options })
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content.
   * @param receipt the receipt to share.
   * @param delegates sharing options for each delegate which will gain access to the entity:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * receipt does not have encrypted content.
   * @return a promise which will contain the updated receipt.
   */
  async shareWithMany(
    receipt: models.Receipt,
    delegates: {
      [delegateId: string]: {
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Receipt> {
    const extended = await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(receipt, true, delegates)
    if (!!extended) {
      return await this.modifyReceipt(extended)
    } else return receipt
  }

  async getDataOwnersWithAccessTo(entity: models.Receipt): Promise<{
    permissionsByDataOwnerId: { [dataOwnerId: string]: 'WRITE' }
    hasUnknownAnonymousDataOwners: boolean
  }> {
    return await this.crypto.entities.getDataOwnersWithAccessTo(entity)
  }

  async getEncryptionKeysOf(entity: models.Receipt): Promise<string[]> {
    return await this.crypto.entities.encryptionKeysOf(entity)
  }
}
