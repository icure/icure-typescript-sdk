import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
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
import { EntityWithDelegationTypeName, ua2ab } from './utils'
import { compressData, decompressData, getCompressionVersion } from './utils/compression-utils'

export class IccReceiptXApi extends IccReceiptApi implements EncryptedEntityXApi<models.Receipt> {
  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.Receipt))
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
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of receipt.
   */
  async newInstance(
    user: models.User,
    r: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
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
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
          )),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Receipt(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          receipt,
          EntityWithDelegationTypeName.Receipt,
          undefined,
          undefined,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
        .then((x) => x.updatedEntity)
    )
  }

  /**
   * Creates a new receipt linked to a document and optionally attaches a blob to it.
   * @param user the current user.
   * @param docId the id of the document this receipt refers to.
   * @param refs an array of reference strings to associate with the receipt.
   * @param blobType the type of the blob attachment.
   * @param blob the binary content to attach; if empty (byteLength == 0), no attachment is set.
   * @return the created receipt, with the attachment set if the blob was non-empty.
   */
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
    const { encryptedData, updatedEntity } = await this.crypto.xapi.encryptDataOf(receipt, EntityWithDelegationTypeName.Receipt, attachment, (r) =>
      this.modifyReceipt(r)
    )
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
    return await this.setReceiptAttachmentForBlobType(receipt.id!, receipt.rev!, blobType, ua2ab(attachment))
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
      { entity: receipt, type: EntityWithDelegationTypeName.Receipt },
      await this.getReceiptAttachment(receipt.id!, attachmentId),
      async (x) => ((await validator(x)) ? x : undefined)
    )
  }

  // --- New data attachment methods (with compression support) ---

  /**
   * Compresses, encrypts, and uploads a receipt attachment using the new data attachment endpoint.
   * Compression is attempted automatically; if the compressed result is not smaller, the original data is used.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment the raw attachment data.
   * @param deflate if true, compress the attachment before uploading. Reliable decompression of compressed data requires version 26.5 of the API and all users to be using at least version 8.7.0 of the SDK    * @return the updated receipt.
   */
  async encryptCompressAndSetReceiptDataAttachment(
    receipt: models.Receipt,
    blobType: string,
    attachment: ArrayBuffer | Uint8Array,
    deflate: boolean = false
  ): Promise<models.Receipt> {
    const realDataSize = ua2ab(attachment).byteLength
    const { data: dataToEncrypt, algorithm: compressionAlgorithm } = deflate
      ? await compressData(attachment)
      : { data: ua2ab(attachment), algorithm: undefined }

    const { encryptedData, updatedEntity } = await this.crypto.xapi.encryptDataOf(
      receipt,
      EntityWithDelegationTypeName.Receipt,
      dataToEncrypt,
      (r) => this.modifyReceipt(r)
    )
    return await this.setReceiptDataAttachment(
      receipt.id!,
      blobType,
      updatedEntity?.rev ?? receipt.rev!,
      encryptedData,
      compressionAlgorithm,
      getCompressionVersion(),
      realDataSize
    )
  }

  /**
   * Compresses and uploads an unencrypted receipt attachment using the new data attachment endpoint.
   * Compression is attempted automatically; if the compressed result is not smaller, the original data is used.
   * @param receipt a receipt.
   * @param blobType the type of the attachment.
   * @param attachment the raw attachment data.
   * @param deflate if true, compress the attachment before uploading. Reliable decompression of compressed data requires version 26.5 of the API and all users to be using at least version 8.7.0 of the SDK    * @return the updated receipt.
   */
  async setClearReceiptDataAttachment(
    receipt: models.Receipt,
    blobType: string,
    attachment: ArrayBuffer | Uint8Array,
    deflate: boolean = false
  ): Promise<models.Receipt> {
    const realDataSize = ua2ab(attachment).byteLength
    const { data: dataToUpload, algorithm: compressionAlgorithm } = deflate
      ? await compressData(attachment)
      : { data: ua2ab(attachment), algorithm: undefined }

    return await this.setReceiptDataAttachment(
      receipt.id!,
      blobType,
      receipt.rev!,
      dataToUpload,
      compressionAlgorithm,
      getCompressionVersion(),
      realDataSize
    )
  }

  /**
   * Gets a receipt's data attachment by blob type, decrypts it, and decompresses if needed.
   * Throws if decryption fails.
   * @param receipt a receipt.
   * @param blobType the blob type of the attachment to retrieve.
   * @param validator optionally a validator function which checks if the decryption was successful.
   * @return the decrypted (and decompressed) attachment.
   */
  async getAndDecryptReceiptDataAttachment(
    receipt: models.Receipt,
    blobType: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<ArrayBuffer> {
    const retrieved = await this.getAndTryDecryptReceiptDataAttachment(receipt, blobType, validator)
    if (!retrieved.wasDecrypted) throw new Error(`No valid key found to decrypt data of receipt ${receipt.id}.`)
    return retrieved.data
  }

  /**
   * Gets a receipt's data attachment by blob type, tries to decrypt it, and decompresses if needed.
   * @param receipt a receipt.
   * @param blobType the blob type of the attachment to retrieve.
   * @param validator optionally a validator function which checks if the decryption was successful.
   * @return an object containing:
   * - data: the decrypted (and decompressed) attachment, or the raw data if decryption failed.
   * - wasDecrypted: if the data was successfully decrypted or not.
   */
  async getAndTryDecryptReceiptDataAttachment(
    receipt: models.Receipt,
    blobType: string,
    validator: (decrypted: ArrayBuffer) => Promise<boolean> = () => Promise.resolve(true)
  ): Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> {
    const compressionAlgorithm = receipt.attachmentInfos?.[blobType]?.compressionAlgorithm
    return await this.crypto.xapi.tryDecryptDataOf(
      { entity: receipt, type: EntityWithDelegationTypeName.Receipt },
      await this.getReceiptAttachmentByBlobType(receipt.id!, blobType),
      async (decrypted) => {
        try {
          const data = compressionAlgorithm ? await decompressData(decrypted, compressionAlgorithm) : decrypted
          return (await validator(data)) ? data : undefined
        } catch {
          return undefined
        }
      }
    )
  }

  /**
   * @return if the logged data owner has write access to the content of the given receipt
   */
  async hasWriteAccess(receipt: models.Receipt): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: receipt, type: EntityWithDelegationTypeName.Receipt })
  }

  /**
   * Share an existing receipt with other data owners, allowing them to access the non-encrypted data of the receipt and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the receipt.
   * @param receipt the receipt to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
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
      shareSecretIds?: string[]
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
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
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
        shareSecretIds?: string[]
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
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
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
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Receipt>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(receipt, EntityWithDelegationTypeName.Receipt)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyReceipt(entityWithEncryptionKey) : receipt
    return this.crypto.xapi.simpleShareOrUpdateEncryptedEntityMetadata(
      {
        entity: updatedEntity,
        type: EntityWithDelegationTypeName.Receipt,
      },
      Object.fromEntries(
        Object.entries(delegates).map(([delegateId, options]) => [
          delegateId,
          {
            requestedPermissions: options.requestedPermissions,
            shareEncryptionKeys: options.shareEncryptionKey,
            shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
            shareSecretIds: options.shareSecretIds,
          },
        ])
      ),
      (x) => this.bulkShareReceipt(x)
    )
  }

  /**
   * Retrieves the data owners that have access to the given receipt, along with their access levels.
   * @param entity the receipt.
   * @return an object containing a map of data owner ids to their access levels, and a flag indicating if there are unknown anonymous data owners.
   */
  getDataOwnersWithAccessTo(
    entity: models.Receipt
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Receipt })
  }

  /**
   * Retrieves the encryption keys of the given receipt.
   * @param entity the receipt.
   * @return the encryption key ids.
   */
  getEncryptionKeysOf(entity: models.Receipt): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Receipt }, undefined)
  }

  /**
   * Creates or updates de-anonymization metadata for the given receipt, allowing the specified delegates to
   * identify the data owners that have access to it.
   * @param entity the receipt.
   * @param delegates the data owner ids for which to create de-anonymization metadata.
   */
  createDelegationDeAnonymizationMetadata(entity: models.Receipt, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Receipt }, delegates)
  }
}
