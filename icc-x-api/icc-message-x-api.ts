import { IccAuthApi, IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'
import { DocIdentifier, ListOfIds, Message, MessagesReadStatusUpdate, PaginatedListMessage, Patient, User } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { FilterChainMessage } from '../icc-api/model/FilterChainMessage'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { AbstractFilter } from './filters/filters'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { SecretIdUseOption } from './crypto/SecretIdUseOption'
import { AbstractFilterMessage } from '../icc-api/model/AbstractFilterMessage'
import { BulkShareOrUpdateMetadataParams } from '../icc-api/model/requests/BulkShareOrUpdateMetadataParams'

export class IccMessageXApi extends IccMessageApi implements EncryptedEntityXApi<models.Message> {
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.Message))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly authApi: IccAuthApi,
    private readonly autofillAuthor: boolean,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    encryptedKeys: Array<string> = [],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'Message.')
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: User, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  /**
   * Creates a new instance of message with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this message refers to.
   * @param m initialised data for the message. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the message. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of message.
   */
  async newInstanceWithPatient(
    user: User,
    patient: Patient | null,
    m: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      sfkOption?: SecretIdUseOption
      alternateRootDelegation?: string
    } = {}
  ) {
    const message = {
      ...(m ?? {}),
      _type: 'org.taktik.icure.entities.Message',
      id: m?.id ?? this.crypto.primitives.randomUuid(),
      created: m?.created ?? new Date().getTime(),
      modified: m?.modified ?? new Date().getTime(),
      responsible: m?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: m?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: m?.codes ?? [],
      tags: m?.tags ?? [],
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient
      ? await this.crypto.xapi.resolveSecretIdUseOptions(
          { entity: patient, type: EntityWithDelegationTypeName.Patient },
          options.sfkOption ?? SecretIdUseOption.UseAnySharedWithParent
        )
      : undefined
    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Message(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          message,
          EntityWithDelegationTypeName.Message,
          patient?.id,
          sfk,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
        .then((x) => x.updatedEntity)
    )
  }

  async decrypt(messages: Array<models.Message>) {
    return await this.crypto.xapi.tryDecryptEntities(messages, EntityWithDelegationTypeName.Message, (x) => new models.Message(x))
  }

  encrypt(messages: Array<models.Message>): Promise<Array<models.Message>> {
    return this.crypto.xapi.tryEncryptEntities(
      messages,
      EntityWithDelegationTypeName.Message,
      this.encryptedFields,
      true,
      false,
      (x) => new models.Message(x)
    )
  }

  /**
   * @param message a message
   * @return the id of the patient that the message refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(message: models.Message): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: message, type: EntityWithDelegationTypeName.Message }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given message
   */
  async hasWriteAccess(message: models.Message): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: message, type: EntityWithDelegationTypeName.Message })
  }

  /**
   * Share an existing message with other data owners, allowing them to access the non-encrypted data of the message and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the message.
   * @param message the message to share.
   * @param shareSecretIds the secret ids of the Message that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Message is the owning entity id.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * message does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this message refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    message: models.Message,
    shareSecretIds: string[],
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Message> {
    return this.shareWithMany(message, { [delegateId]: { ...options, shareSecretIds } })
  }

  /**
   * Share an existing message with other data owners, allowing them to access the non-encrypted data of the message and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param message the message to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds the secret ids of the Message that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Message is the owning entity id. Mandatory.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * message does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this message refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    message: models.Message,
    delegates: {
      [delegateId: string]: {
        shareSecretIds: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Message> {
    return (await this.tryShareWithMany(message, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing message with other data owners, allowing them to access the non-encrypted data of the message and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param message the message to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds the secret ids of the Message that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Message is the owning entity id. Mandatory.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * message does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this message refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    message: models.Message,
    delegates: {
      [delegateId: string]: {
        shareSecretIds: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Message>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(message, EntityWithDelegationTypeName.Message)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyMessageWithUser(undefined, entityWithEncryptionKey) : message
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.Message,
        },
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: options.shareSecretIds,
            },
          ])
        ),
        (x) => super.bulkShareMessages(x)
      )
      .then((r) => r.mapSuccessAsync(async (m) => (await this.decrypt([m]))[0].entity))
  }

  /**
   * @param message a message
   * @return the secret ids of the message, retrieved from the encrypted metadata. The result may be used to find entities where the message is
   * the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptSecretIdsOf(message: models.Message): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: message, type: EntityWithDelegationTypeName.Message }, undefined)
  }

  createDelegationDeAnonymizationMetadata(entity: Message, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Message }, delegates)
  }

  getDataOwnersWithAccessTo(
    entity: models.Message
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Message })
  }

  getEncryptionKeysOf(entity: models.Message): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Message }, undefined)
  }

  async subscribeToMessageEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<Message> | undefined,
    eventFired: (message: Message) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    return await subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.Message,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt([encrypted]))[0].entity
    ).then((rs) => new ConnectionImpl(rs))
  }

  private async decryptPage(page: PaginatedListMessage): Promise<PaginatedListMessage> {
    return {
      ...page,
      rows: (await this.decrypt(page.rows ?? [])).map((x) => x.entity),
    }
  }

  async createMessageWithUser(user: models.User | undefined, body: Message): Promise<Message> {
    return (await this.decrypt([await super.createMessage((await this.encrypt([body]))[0])]))[0].entity
  }

  async findMessagesWithUser(
    user: models.User | undefined,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessages(startKey, startDocumentId, limit))
  }

  async findMessagesByFromAddressWithUser(
    user: models.User | undefined,
    fromAddress?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessagesByFromAddress(fromAddress, startKey, startDocumentId, limit, hcpId))
  }

  /**
   * @deprecated
   */
  async findMessagesByHCPartyPatientForeignKeysUsingPostWithUser(user: models.User | undefined, body?: Array<string>): Promise<Array<Message>> {
    return (await this.decrypt(await super.findMessagesByHCPartyPatientForeignKeysUsingPost(body))).map((x) => x.entity)
  }

  /**
   * @deprecated
   */
  async findMessagesByHCPartyPatientForeignKeysWithUser(user: models.User | undefined, secretFKeys: string): Promise<Array<Message>> {
    return (await this.decrypt(await super.findMessagesByHCPartyPatientForeignKeys(secretFKeys))).map((x) => x.entity)
  }

  async findMessagesByToAddressWithUser(
    user: models.User | undefined,
    toAddress?: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    reverse?: boolean,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessagesByToAddress(toAddress, startKey, startDocumentId, limit, reverse, hcpId))
  }

  async findMessagesByTransportGuidWithUser(
    user: models.User | undefined,
    transportGuid?: string,
    received?: boolean,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessagesByTransportGuid(transportGuid, received, startKey, startDocumentId, limit, hcpId))
  }

  async findMessagesByTransportGuidSentDateWithUser(
    user: models.User | undefined,
    transportGuid?: string,
    from?: number,
    to?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessagesByTransportGuidSentDate(transportGuid, from, to, startKey, startDocumentId, limit, hcpId))
  }

  async getChildrenMessagesWithUser(user: models.User | undefined, messageId: string): Promise<Array<Message>> {
    return (await this.decrypt(await super.getChildrenMessages(messageId))).map((x) => x.entity)
  }

  async getChildrenMessagesOfListWithUser(user: models.User | undefined, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.getChildrenMessagesOfList(body))).map((x) => x.entity)
  }

  async getMessageWithUser(user: models.User | undefined, messageId: string): Promise<Message> {
    return (await this.decrypt([await super.getMessage(messageId)]))[0].entity
  }

  async getMessagesWithUser(user: models.User | undefined, messageIds: ListOfIds): Promise<Message[]> {
    return (await this.decrypt(await super.getMessages(messageIds))).map((x) => x.entity)
  }

  async listMessagesByInvoiceIdsWithUser(user: models.User | undefined, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.listMessagesByInvoiceIds(body))).map((x) => x.entity)
  }

  async listMessagesByTransportGuidsWithUser(user: models.User | undefined, hcpId: string, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.listMessagesByTransportGuids(hcpId, body))).map((x) => x.entity)
  }

  async modifyMessageWithUser(user: models.User | undefined, body: Message): Promise<Message> {
    return (await this.decrypt([await super.modifyMessage((await this.encrypt([body]))[0])]))[0].entity
  }

  async setMessagesStatusBitsWithUser(user: models.User | undefined, status: number, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.setMessagesStatusBits(status, body))).map((x) => x.entity)
  }

  async filterMessagesByWithUser(
    user: models.User | undefined,
    body: FilterChainMessage,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.filterMessagesBy(body, startDocumentId, limit))
  }

  async setMessagesReadStatusWithUser(user: models.User | undefined, body?: MessagesReadStatusUpdate): Promise<Array<Message>> {
    return (await this.decrypt(await super.setMessagesReadStatus(body))).map((x) => x.entity)
  }

  createMessage(body?: Message): never {
    throw new Error('Use withUser method')
  }

  findMessages(startKey?: string, startDocumentId?: string, limit?: number): never {
    throw new Error('Use withUser method')
  }

  findMessagesByFromAddress(fromAddress?: string, startKey?: string, startDocumentId?: string, limit?: number, hcpId?: string): never {
    throw new Error('Use withUser method')
  }

  findMessagesByHCPartyPatientForeignKeysUsingPost(body?: Array<string>): never {
    throw new Error('Use withUser method')
  }

  findMessagesByHCPartyPatientForeignKeys(secretFKeys: string): never {
    throw new Error('Use withUser method')
  }

  findMessagesByToAddress(toAddress?: string, startKey?: string, startDocumentId?: string, limit?: number, reverse?: boolean, hcpId?: string): never {
    throw new Error('Use withUser method')
  }

  findMessagesByTransportGuid(
    transportGuid?: string,
    received?: boolean,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): never {
    throw new Error('Use withUser method')
  }

  findMessagesByTransportGuidSentDate(
    transportGuid?: string,
    from?: number,
    to?: number,
    startKey?: string,
    startDocumentId?: string,
    limit?: number,
    hcpId?: string
  ): never {
    throw new Error('Use withUser method')
  }

  getChildrenMessages(messageId: string): never {
    throw new Error('Use withUser method')
  }

  getChildrenMessagesOfList(body?: ListOfIds): never {
    throw new Error('Use withUser method')
  }

  getMessage(messageId: string): never {
    throw new Error('Use withUser method')
  }

  getMessages(messageIds: ListOfIds): never {
    throw new Error('Use withUser method')
  }

  listMessagesByInvoiceIds(body?: ListOfIds): never {
    throw new Error('Use withUser method')
  }

  listMessagesByTransportGuids(hcpId: string, body?: ListOfIds): never {
    throw new Error('Use withUser method')
  }

  modifyMessage(body?: Message): never {
    throw new Error('Use withUser method')
  }

  setMessagesStatusBits(status: number, body?: ListOfIds): never {
    throw new Error('Use withUser method')
  }

  filterMessagesBy(body: FilterChainMessage, startDocumentId?: string, limit?: number): never {
    throw new Error('Use withUser method')
  }

  setMessagesReadStatus(body?: MessagesReadStatusUpdate): never {
    throw new Error('Use withUser method')
  }
}
