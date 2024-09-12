import { IccAuthApi, IccTopicApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { ListOfIds, MaintenanceTask, Topic, TopicRole } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { FilterChainTopic } from '../icc-api/model/FilterChainTopic'
import { PaginatedListTopic } from '../icc-api/model/PaginatedListTopic'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { AbstractFilter } from './filters/filters'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'

// noinspection JSUnusedGlobalSymbols
export class IccTopicXApi extends IccTopicApi implements EncryptedEntityXApi<models.Topic> {
  private readonly encryptedFields: EncryptedFieldsManifest

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly authApi: IccAuthApi,
    private readonly autofillAuthor: boolean,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    encryptedKeys: Array<string> = ['description'],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)

    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'Topic.')
  }

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.Topic))
  }

  /**
   * Creates a new instance of topic with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this topic refers to.
   * @param c initialised data for the topic. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the topic. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of topic.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient | null,
    c: Topic = {}, // TODO: Why this isn't Topic?
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ) {
    if (!patient && options.preferredSfk) throw new Error('preferredSfk can only be specified if patient is specified.')

    const topic = {
      ...(c ?? {}),
      id: c?.id ?? this.crypto.primitives.randomUuid(),
      _type: 'org.taktik.icure.entities.Topic',
      created: c?.created ?? new Date().getTime(),
      modified: c?.modified ?? new Date().getTime(),
      responsible: c?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: c?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: c?.codes ?? [],
      tags: c?.tags ?? [],
    }

    const extraDelegations = {
      ...Object.fromEntries((user.autoDelegations?.all ?? []).map((d) => [d, AccessLevelEnum.WRITE])),
      ...(options?.additionalDelegates ?? {}),
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient
      ? options.preferredSfk ??
        (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient }))
      : undefined

    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)

    return new models.Topic(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(topic, EntityWithDelegationTypeName.Topic, patient?.id, sfk, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  async decrypt(topics: Array<models.Topic>) {
    return await Promise.all(
      topics.map((topic) =>
        this.crypto.xapi.decryptEntity(topic, EntityWithDelegationTypeName.Topic, (x) => new models.Topic(x)).then(({ entity }) => entity)
      )
    )
  }

  async encrypt(topics: Array<models.Topic>): Promise<Array<models.Topic>> {
    return await Promise.all(
      topics.map((p) =>
        this.crypto.xapi.tryEncryptEntity(p, EntityWithDelegationTypeName.Topic, this.encryptedFields, true, false, (x) => new models.Topic(x))
      )
    )
  }

  /**
   * Create and share a new topic with other participants.
   * @param body the topic to create.
   * @return the created topic.
   */
  override async createTopic(body: Topic): Promise<Topic> {
    const encryptedTopics = await this.encrypt([body])
    const createdTopic = await super.createTopic(encryptedTopics[0])
    const decryptedTopics = await this.decrypt([createdTopic])
    return decryptedTopics[0]
  }

  /**
   * @param topic a topic
   * @return the id of the patient that the topic refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(topic: models.Topic): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: topic, type: EntityWithDelegationTypeName.Topic }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given topic
   */
  async hasWriteAccess(topic: models.Topic): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: topic, type: EntityWithDelegationTypeName.Topic })
  }

  /**
   * Share an existing topic with other data owners, allowing them to access the non-encrypted data of the topic and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the topic.
   * @param topic the topic to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - sharePatientId: specifies if the id of the patient that this topic refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    topic: models.Topic,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Topic> {
    return this.shareWithMany(topic, { [delegateId]: options })
  }

  /**
   * Share an existing topic with other data owners, allowing them to access the non-encrypted data of the topic and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param topic the topic to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * topic does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this topic refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    topic: models.Topic,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Topic> {
    return (await this.tryShareWithMany(topic, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing topic with other data owners, allowing them to access the non-encrypted data of the topic and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param topic the topic to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * topic does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this topic refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    topic: models.Topic,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Topic>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(topic, EntityWithDelegationTypeName.Topic)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyTopic(entityWithEncryptionKey) : topic
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.Topic,
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
        (x) => this.bulkShareTopics(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt([e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: models.Topic
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Topic })
  }

  getEncryptionKeysOf(entity: models.Topic): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Topic }, undefined)
  }

  /**
   * Filter and decrypt topics by the given filter.
   * @param body the filter to apply.
   * @param startDocumentId the document id to start from (inclusive).
   * @param limit the maximum number of topics to return in the page.
   * @return a paginated list of topics.
   */
  override async filterTopicsBy(body: FilterChainTopic, startDocumentId?: string, limit?: number): Promise<PaginatedListTopic> {
    const page = await super.filterTopicsBy(body, startDocumentId, limit)
    const decryptedTopics = await this.decrypt(page.rows ?? [])
    return {
      ...page,
      rows: decryptedTopics,
    }
  }

  /**
   * Obtain the topic with the given id and decrypt it.
   * @param id the id of the topic to retrieve.
   * @return the decrypted topic.
   */
  override async getTopic(id: string): Promise<Topic> {
    const topic = await super.getTopic(id)
    const decryptedTopics = await this.decrypt([topic])
    return decryptedTopics[0]
  }

  /**
   * Obtain the topics with the given ids and decrypt them.
   * @param body the ids of the topics to retrieve.
   * @return the decrypted topics.
   */
  override async getTopics(body: ListOfIds): Promise<Array<Topic>> {
    const topics = await super.getTopics(body)
    return await this.decrypt(topics)
  }

  /**
   * Update and encrypt the given topic.
   * @param body the topic to update.
   * @return the updated decrypted topic.
   */
  override async modifyTopic(body: Topic): Promise<Topic> {
    const encryptedTopics = await this.encrypt([body])
    const modifiedTopic = await super.modifyTopic(encryptedTopics[0])
    const decryptedTopics = await this.decrypt([modifiedTopic])
    return decryptedTopics[0]
  }

  /**
   * @internal this method is for internal use only and may be changed without notice
   * @param body data owner id of the data owner to which the participant should be added and the topic role of the participant.
   * @param topicId Id of the topic to which the participant should be added.
   */
  override async addParticipant(body: { dataOwnerId: string; topicRole: TopicRole }, topicId: string): Promise<Topic> {
    throw new Error('Cannot add participant to topic without sharing it first. You should use addParticipantWithTopic instead.')
  }

  /**
   * This method is similar to {@link addParticipant} but it also shares the topic with the data owner before adding the participant.
   * @param body data owner id of the data owner to which the participant should be added and the topic role of the participant.
   * @param topic the topic to share and to which the participant should be added.
   * @return the updated topic.
   */
  async addParticipantWithTopic(body: { dataOwnerId: string; topicRole: TopicRole }, topic: Topic): Promise<Topic> {
    const updatedTopic = await this.shareWith(body.dataOwnerId, topic, {
      requestedPermissions: RequestedPermissionEnum.FULL_WRITE,
    })

    return (await this.decrypt([await super.addParticipant(body, updatedTopic.id!)]))[0]
  }

  /**
   * Remove the participant with the given data owner id from the topic with the given id.
   * @param body data owner id of the participant to remove.
   * @param topicId Id of the topic from which the participant should be removed.
   * @return the updated decrypted topic.
   */
  async removeParticipant(body: { dataOwnerId: string }, topicId: string): Promise<Topic> {
    const updatedTopic = await super.removeParticipant(body, topicId)
    return (await this.decrypt([updatedTopic]))[0]
  }

  async subscribeToTopicEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<Topic> | undefined,
    eventFired: (message: Topic) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    return await subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.Topic,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt([encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  createDelegationDeAnonymizationMetadata(entity: Topic, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Topic }, delegates)
  }
}
