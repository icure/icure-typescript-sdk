import { IccAuthApi, IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'
import { DocIdentifier, ListOfIds, Message, MessagesReadStatusUpdate, PaginatedListMessage, Patient, TimingInfo, User } from '../icc-api/model/models'
import { cloneDeep } from './utils/collection-utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { SecretIdShareOptions } from './crypto/ShareSecretIdOptions'
import { ShareResult } from './utils/ShareResult'
import { ShareByIdResult } from './utils/ShareByIdResult'
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
  /**
   * Creates a new instance of message with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param m initialised data for the message. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @return a new instance of message.
   */
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

  /**
   * Decrypts the encrypted content of messages.
   * @param messages the messages to decrypt.
   * @return the decrypted messages with their encryption status.
   */
  async decrypt(messages: Array<models.Message>) {
    return await this.crypto.xapi.tryDecryptEntities(messages, EntityWithDelegationTypeName.Message, (x) => new models.Message(x))
  }

  /**
   * Encrypts the content of messages.
   * @param messages the messages to encrypt.
   * @return the encrypted messages.
   */
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
   * Shares the messages with the provided ids with one or more delegates, using the same share options for all of
   * them.
   *
   * Unlike {@link shareWith} this method does not need the decrypted messages, does not return them, and does not
   * fail because of a single message or delegate: the outcome of each (message, delegate) pair is reported in
   * the returned {@link ShareByIdResult}. Ids of messages that don't exist or that the current user can't read are
   * reported in {@link ShareByIdResult.notFoundIds} and are otherwise ignored.
   * @param ids the ids of the messages to share. Duplicates are ignored.
   * @param delegates associates the id of the data owners which will be granted access to the messages to the
   * following sharing options:
   * - shareSecretIds specifies which secret ids of each of the messages should be shared: with
   * {@link SecretIdShareOptions.AllAvailable} (the default) each of them is shared with all the secret ids of that entity
   * that the current data owner can access, with {@link SecretIdShareOptions.UseExactly} they are all shared with exactly
   * the provided secret ids.
   * - requestedPermissions requested permissions for the delegate. Defaults to
   * {@link RequestedPermissionEnum.MAX_WRITE}.
   * - shareEncryptionKey specifies if the encryption key of the messages should be shared: this is needed for the
   * delegate to be able to decrypt their content. Defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * - sharePatientId specifies if the id of the patient the messages refer to should be shared with the delegate. Defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * @return a promise which will be completed with the outcome of the operation for each (message, delegate) pair.
   */
  async shareById(
    ids: string[],
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: SecretIdShareOptions // Defaults to all available without being required
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareByIdResult> {
    return this.crypto.xapi.shareById(
      ids,
      Object.fromEntries(
        Object.entries(delegates).map(([delegateId, options]) => [
          delegateId,
          {
            shareSecretIds: options.shareSecretIds,
            requestedPermissions: options.requestedPermissions,
            shareEncryptionKeys: options.shareEncryptionKey,
            shareOwningEntityIds: options.sharePatientId,
          },
        ])
      ),
      EntityWithDelegationTypeName.Message,
      (x) => this.findMessagesDelegationsStubsByIds(x),
      (x) => super.bulkShareMessagesMinimal(x)
    )
  }

  /**
   * @param message a message
   * @return the secret ids of the message, retrieved from the encrypted metadata. The result may be used to find entities where the message is
   * the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  decryptSecretIdsOf(message: models.Message): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: message, type: EntityWithDelegationTypeName.Message }, undefined)
  }

  /**
   * Creates or updates de-anonymization metadata for the message, allowing resolution of anonymous delegations.
   * @param entity the message.
   * @param delegates the data owner ids of the delegates.
   */
  createDelegationDeAnonymizationMetadata(entity: Message, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Message }, delegates)
  }

  /**
   * Retrieves the data owners that have access to the message.
   * @param entity the message.
   * @return the data owners with their access levels and a flag indicating if there are unknown anonymous data owners.
   */
  getDataOwnersWithAccessTo(
    entity: models.Message
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Message })
  }

  /**
   * Retrieves the encryption keys of the message.
   * @param entity the message.
   * @return the encryption keys.
   */
  getEncryptionKeysOf(entity: models.Message): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Message }, undefined)
  }

  /**
   * Subscribes to message events (create, update, delete).
   * @param eventTypes the types of events to subscribe to.
   * @param filter optional filter to apply to the events.
   * @param eventFired callback function to be called when an event is fired.
   * @param options optional subscription options.
   * @return a connection that can be used to close the subscription.
   */
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

  /**
   * Creates a message.
   * @param user the current user (unused, for compatibility).
   * @param body the message to create.
   * @return the created message.
   */
  async createMessageWithUser(user: models.User | undefined, body: Message): Promise<Message> {
    return (await this.decrypt([await super.createMessage((await this.encrypt([body]))[0])]))[0].entity
  }

  /**
   * Finds messages with pagination.
   * @param user the current user (unused, for compatibility).
   * @param startKey optional start key for pagination.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @return a paginated list of messages.
   */
  async findMessagesWithUser(
    user: models.User | undefined,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.findMessages(startKey, startDocumentId, limit))
  }

  /**
   * Finds messages by sender address with pagination.
   * @param user the current user (unused, for compatibility).
   * @param fromAddress the sender address to filter by.
   * @param startKey optional start key for pagination.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @param hcpId optional healthcare party id to filter by.
   * @return a paginated list of messages.
   */
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

  /**
   * Finds messages by recipient address with pagination.
   * @param user the current user (unused, for compatibility).
   * @param toAddress the recipient address to filter by.
   * @param startKey optional start key for pagination.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @param reverse optional flag to reverse the sort order.
   * @param hcpId optional healthcare party id to filter by.
   * @return a paginated list of messages.
   */
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

  /**
   * Finds messages by transport GUID with pagination.
   * @param user the current user (unused, for compatibility).
   * @param transportGuid the transport GUID to filter by.
   * @param received optional flag to filter by received status.
   * @param startKey optional start key for pagination.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @param hcpId optional healthcare party id to filter by.
   * @return a paginated list of messages.
   */
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

  /**
   * Finds messages by transport GUID and sent date range with pagination.
   * @param user the current user (unused, for compatibility).
   * @param transportGuid the transport GUID to filter by.
   * @param from optional start timestamp for the date range.
   * @param to optional end timestamp for the date range.
   * @param startKey optional start key for pagination.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @param hcpId optional healthcare party id to filter by.
   * @return a paginated list of messages.
   */
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

  /**
   * Retrieves the children messages of a message.
   * @param user the current user (unused, for compatibility).
   * @param messageId the id of the parent message.
   * @return the children messages.
   */
  async getChildrenMessagesWithUser(user: models.User | undefined, messageId: string): Promise<Array<Message>> {
    return (await this.decrypt(await super.getChildrenMessages(messageId))).map((x) => x.entity)
  }

  /**
   * Retrieves the children messages of a list of parent messages.
   * @param user the current user (unused, for compatibility).
   * @param body the list of parent message ids.
   * @return the children messages.
   */
  async getChildrenMessagesOfListWithUser(user: models.User | undefined, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.getChildrenMessagesOfList(body))).map((x) => x.entity)
  }

  /**
   * Retrieves a message by its id.
   * @param user the current user (unused, for compatibility).
   * @param messageId the id of the message.
   * @return the message.
   */
  async getMessageWithUser(user: models.User | undefined, messageId: string): Promise<Message> {
    return (await this.decrypt([await super.getMessage(messageId)]))[0].entity
  }

  /**
   * Retrieves multiple messages by their ids.
   * @param user the current user (unused, for compatibility).
   * @param messageIds the list of message ids.
   * @return the messages.
   */
  async getMessagesWithUser(user: models.User | undefined, messageIds: ListOfIds): Promise<Message[]> {
    return (await this.decrypt(await super.getMessages(messageIds))).map((x) => x.entity)
  }

  /**
   * Lists messages by invoice ids.
   * @param user the current user (unused, for compatibility).
   * @param body the list of invoice ids.
   * @return the messages associated with the invoices.
   */
  async listMessagesByInvoiceIdsWithUser(user: models.User | undefined, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.listMessagesByInvoiceIds(body))).map((x) => x.entity)
  }

  /**
   * Lists messages by transport GUIDs.
   * @param user the current user (unused, for compatibility).
   * @param hcpId the healthcare party id.
   * @param body the list of transport GUIDs.
   * @return the messages associated with the transport GUIDs.
   */
  async listMessagesByTransportGuidsWithUser(user: models.User | undefined, hcpId: string, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.listMessagesByTransportGuids(hcpId, body))).map((x) => x.entity)
  }

  /**
   * Modifies a message.
   * @param user the current user (unused, for compatibility).
   * @param body the message to modify.
   * @return the modified message.
   */
  async modifyMessageWithUser(user: models.User | undefined, body: Message): Promise<Message> {
    return (await this.decrypt([await super.modifyMessage((await this.encrypt([body]))[0])]))[0].entity
  }

  /**
   * Sets the status bits of multiple messages.
   * @param user the current user (unused, for compatibility).
   * @param status the status bits to set.
   * @param body the list of message ids.
   * @return the updated messages.
   */
  async setMessagesStatusBitsWithUser(user: models.User | undefined, status: number, body?: ListOfIds): Promise<Array<Message>> {
    return (await this.decrypt(await super.setMessagesStatusBits(status, body))).map((x) => x.entity)
  }

  /**
   * Filters messages using a filter chain with pagination.
   * @param user the current user (unused, for compatibility).
   * @param body the filter chain to apply.
   * @param startDocumentId optional start document id for pagination.
   * @param limit optional maximum number of results to return.
   * @param collectTiming add timing information to the response
   * @return a paginated list of filtered messages.
   */
  async filterMessagesByWithUser(
    user: models.User | undefined,
    body: FilterChainMessage,
    startDocumentId?: string,
    limit?: number,
    collectTiming?: false
  ): Promise<PaginatedListMessage>
  async filterMessagesByWithUser(
    user: models.User | undefined,
    body: FilterChainMessage,
    startDocumentId?: string,
    limit?: number,
    collectTiming?: true
  ): Promise<PaginatedListMessage & TimingInfo>
  async filterMessagesByWithUser(
    user: models.User | undefined,
    body: FilterChainMessage,
    startDocumentId?: string,
    limit?: number,
    collectTiming: boolean = false
  ): Promise<PaginatedListMessage> {
    return await this.decryptPage(await super.filterMessagesBy(body, startDocumentId, limit, collectTiming as any))
  }

  /**
   * Sets the read status of multiple messages.
   * @param user the current user (unused, for compatibility).
   * @param body the read status update information.
   * @return the updated messages.
   */
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

  /**
   * Like {@link getConflictsForEntity} but additionally decrypts the conflicting revisions for the given user.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param entityId the id of the message to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the message.
   */
  getConflictsForEntityWithUser(user: models.User, entityId: string): Promise<Array<models.Message>> {
    return super
      .getConflictsForEntity(entityId)
      .then((ms) => this.decrypt(ms))
      .then((res) => res.map(({ entity }) => entity))
  }

  /**
   * Like {@link declareConflictWinner} but encrypts the winning revision before sending it and decrypts the saved
   * winner returned by the backend.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerWithUser(
    user: models.User,
    request: models.ConflictResolutionRequest<models.Message>
  ): Promise<models.ConflictResolutionResult<models.Message>> {
    const encrypted = (await this.encrypt([cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinner({ ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt([result.document]))[0].entity
    return result
  }

  /**
   * Like {@link getConflictsForEntityWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param groupId the id of the group the message belongs to.
   * @param entityId the id of the message to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the message.
   */
  getConflictsForEntityInGroupWithUser(user: models.User, groupId: string, entityId: string): Promise<Array<models.Message>> {
    return super
      .getConflictsForEntityInGroup(groupId, entityId)
      .then((ms) => this.decrypt(ms))
      .then((res) => res.map(({ entity }) => entity))
  }

  /**
   * Like {@link declareConflictWinnerWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param groupId the id of the group the message belongs to.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerInGroupWithUser(
    user: models.User,
    groupId: string,
    request: models.ConflictResolutionRequest<models.Message>
  ): Promise<models.ConflictResolutionResult<models.Message>> {
    const encrypted = (await this.encrypt([cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinnerInGroup(groupId, { ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt([result.document]))[0].entity
    return result
  }
}
