import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './utils/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum

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
   * @param optionalParams optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * @return a new instance of receipt.
   */
  async newInstance(
    user: models.User,
    r: any,
    optionalParams: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
    } = {}
  ): Promise<models.Receipt> {
    const receipt = new models.Receipt(
      _.extend(
        {
          id: this.crypto.primitives.randomUuid(),
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

    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(optionalParams?.additionalDelegates ?? {}),
    }
    return new models.Receipt(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(receipt, 'Receipt', undefined, undefined, true, false, extraDelegations)
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
    const encryptedData = await this.crypto.xapi.encryptDataOf({ entity: receipt, type: 'Receipt' }, attachment)
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
    return await this.crypto.xapi.decryptDataOf(
      { entity: receipt, type: 'Receipt' },
      await this.getReceiptAttachment(receipt.id!, attachmentId),
      (x) => validator(x)
    )
  }

  /**
   * @return if the logged data owner has write access to the content of the given classification
   */
  async hasWriteAccess(classification: models.Classification): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: classification, type: 'Classification' })
  }

  /**
   * Share an existing classification with other data owners, allowing them to access the non-encrypted data of the classification and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the classification.
   * @param classification the classification to share.
   * @param requestedPermissions the requested permissions for the delegate.
   * @param optionalParams optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * classification does not have encrypted content.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async shareWith(
    delegateId: string,
    classification: models.Classification,
    requestedPermissions: RequestedPermissionEnum,
    optionalParams: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<ShareResult<models.Classification>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(classification, 'Receipt')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyReceipt(entityWithEncryptionKey) : classification
    return this.crypto.xapi.simpleShareOrUpdateEncryptedEntityMetadata(
      { entity: updatedEntity, type: 'Classification' },
      delegateId,
      optionalParams?.shareEncryptionKey,
      undefined,
      undefined,
      requestedPermissions,
      (x) => this.bulkShareReceipt(x)
    )
  }
}
