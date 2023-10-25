import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { MaintenanceTask } from '../icc-api/model/models'

export class IccReceiptXApi extends IccReceiptApi implements EncryptedEntityXApi<models.Receipt> {
  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, 'Receipt'))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly autofillAuthor: boolean,
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
   * auto-delegations, in such case the access level specified here will be used.
   * @return a new instance of receipt.
   */
  async newInstance(
    user: models.User,
    r: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
    } = {}
  ): Promise<models.Receipt> {
    const receipt = new models.Receipt({
      ...(r ?? {}),
      _type: 'org.taktik.icure.entities.Receipt',
      id: r?.id ?? this.crypto.primitives.randomUuid(),
      created: r?.created ?? new Date().getTime(),
      modified: r?.modified ?? new Date().getTime(),
      responsible: r?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: r?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: r?.codes ?? [],
      tags: r?.tags ?? [],
    })

    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
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
    const { encryptedData, updatedEntity } = await this.crypto.xapi.encryptDataOf(receipt, 'Receipt', attachment, (r) => this.modifyReceipt(r))
    return await this.setReceiptAttachmentForBlobType(receipt.id!, updatedEntity?.rev ?? receipt.rev!, blobType, encryptedData)
  }

  /**
   * Adds an unencrypted attachment to a receipt.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment a attachment for the receipt.
   * @return the updated receipt.
   */
  async setClearReceiptAttachment(receipt: models.Receipt, blobType: string, attachment: ArrayBuffer | Uint8Array): Promise<models.Receipt> {
    return await this.setReceiptAttachmentForBlobType(receipt.id!, receipt.rev!, blobType, attachment)
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
    const retrieved = await this.getAndTryDecryptReceiptAttachment(receipt, attachmentId, (x) => validator(x))
    if (!retrieved.wasDecrypted) throw new Error(`No valid key found to decrypt data of receipt ${receipt.id}.`)
    return retrieved.data
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
    return await this.crypto.xapi.tryDecryptDataOf(
      { entity: receipt, type: 'Receipt' },
      await this.getReceiptAttachment(receipt.id!, attachmentId),
      (x) => validator(x)
    )
  }

  /**
   * @return if the logged data owner has write access to the content of the given receipt
   */
  async hasWriteAccess(receipt: models.Receipt): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: receipt, type: 'Receipt' })
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the receipt.
   * @param receipt the receipt to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * receipt does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    receipt: models.Receipt,
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Receipt> {
    return this.shareWithMany(receipt, { [delegateId]: options })
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param receipt the receipt to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * receipt does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    receipt: models.Receipt,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Receipt> {
    return (await this.tryShareWithMany(receipt, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param receipt the receipt to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * receipt does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    receipt: models.Receipt,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Receipt>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(receipt, 'Receipt')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyReceipt(entityWithEncryptionKey) : receipt
    return this.crypto.xapi.simpleShareOrUpdateEncryptedEntityMetadata(
      { entity: updatedEntity, type: 'Receipt' },
      true,
      Object.fromEntries(
        Object.entries(delegates).map(([delegateId, options]) => [
          delegateId,
          {
            requestedPermissions: options.requestedPermissions,
            shareEncryptionKeys: options.shareEncryptionKey,
            shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
            shareSecretIds: undefined,
          },
        ])
      ),
      (x) => this.bulkShareReceipt(x)
    )
  }

  getDataOwnersWithAccessTo(
    entity: models.Receipt
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: 'Receipt' })
  }

  getEncryptionKeysOf(entity: models.Receipt): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: 'Receipt' }, undefined)
  }

  createDelegationDeAnonymizationMetadata(entity: models.Receipt, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: 'Receipt' }, delegates)
  }
}
