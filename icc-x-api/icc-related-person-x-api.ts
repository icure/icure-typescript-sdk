import { IccRelatedPersonApi } from '../icc-api/api/IccRelatedPersonApi'
import { IccAuthApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { cloneDeep } from './utils/collection-utils'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { AbstractFilter } from './filters/filters'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'

export class IccRelatedPersonXApi extends IccRelatedPersonApi implements EncryptedEntityXApi<models.RelatedPerson> {
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.RelatedPerson))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly authApi: IccAuthApi,
    private readonly autofillAuthor: boolean,
    encryptedKeys: Array<string> = [],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'RelatedPerson.')
  }

  /**
   * Creates a new instance of related person with initialised encryption metadata (not in the database).
   * A related person is a root entity: it is not linked to any owning entity.
   * @param user the current user.
   * @param r initialised data for the related person. Metadata such as id, creation data, etc. will be automatically initialised, but you can
   * specify other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of related person.
   */
  async newInstance(
    user: models.User,
    r: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ): Promise<models.RelatedPerson> {
    const relatedPerson = {
      ...(r ?? {}),
      _type: 'org.taktik.icure.entities.RelatedPerson',
      id: r?.id ?? this.crypto.primitives.randomUuid(),
      created: r?.created ?? new Date().getTime(),
      modified: r?.modified ?? new Date().getTime(),
      responsible: r?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: r?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: r?.codes ?? [],
      tags: r?.tags ?? [],
    }

    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
          )),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.RelatedPerson(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          relatedPerson,
          EntityWithDelegationTypeName.RelatedPerson,
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
   * @throws always. Use {@link createRelatedPersonWithUser} instead.
   */
  createRelatedPerson(body: models.RelatedPerson): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Encrypts and creates a related person.
   * @param user the current user, used for encryption.
   * @param body the related person to create, with initialised encryption metadata (see {@link newInstance}).
   * @return the created and decrypted related person.
   */
  async createRelatedPersonWithUser(user: models.User, body: models.RelatedPerson): Promise<models.RelatedPerson> {
    const encrypted = (await this.encrypt(user, [cloneDeep(body)]))[0]
    const created = await super.createRelatedPerson(encrypted)
    return (await this.decrypt(user, [created]))[0]
  }

  /**
   * @throws always. Use {@link createRelatedPersonsWithUser} instead.
   */
  createRelatedPersons(body: Array<models.RelatedPerson>): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Encrypts and creates multiple related persons.
   * @param user the current user, used for encryption.
   * @param bodies the related persons to create, with initialised encryption metadata (see {@link newInstance}).
   * @return the created and decrypted related persons.
   */
  async createRelatedPersonsWithUser(user: models.User, bodies: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    if (!bodies.length) return []
    const encrypted = await this.encrypt(
      user,
      bodies.map((b) => cloneDeep(b))
    )
    const created = await super.createRelatedPersons(encrypted)
    return this.decrypt(user, created)
  }

  /**
   * @throws always. Use {@link getRelatedPersonWithUser} instead.
   */
  getRelatedPerson(relatedPersonId: string): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Retrieves a related person by id and decrypts it.
   * @param user the current user, used for decryption.
   * @param relatedPersonId the id of the related person to retrieve.
   * @return the decrypted related person.
   */
  async getRelatedPersonWithUser(user: models.User, relatedPersonId: string): Promise<models.RelatedPerson> {
    const relatedPerson = await super.getRelatedPerson(relatedPersonId)
    return (await this.decrypt(user, [relatedPerson]))[0]
  }

  /**
   * @throws always. Use {@link getRelatedPersonsWithUser} instead.
   */
  getRelatedPersons(body: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Retrieves multiple related persons by their ids and decrypts them.
   * @param user the current user, used for decryption.
   * @param body the list of related person ids to retrieve.
   * @return the decrypted related persons.
   */
  async getRelatedPersonsWithUser(user: models.User, body: models.ListOfIds): Promise<Array<models.RelatedPerson>> {
    return this.decrypt(user, await super.getRelatedPersons(body))
  }

  /**
   * @throws always. Use {@link modifyRelatedPersonWithUser} instead.
   */
  modifyRelatedPerson(body: models.RelatedPerson): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Encrypts and updates a related person.
   * @param user the current user, used for encryption.
   * @param body the related person to update.
   * @return the updated and decrypted related person.
   */
  async modifyRelatedPersonWithUser(user: models.User, body: models.RelatedPerson): Promise<models.RelatedPerson> {
    return this.doModifyRelatedPerson(body)
  }

  private async doModifyRelatedPerson(body: models.RelatedPerson): Promise<models.RelatedPerson> {
    const encrypted = (await this.doEncrypt([cloneDeep(body)]))[0]
    const modified = await super.modifyRelatedPerson(encrypted)
    return (await this.doDecrypt([modified]))[0]
  }

  /**
   * @throws always. Use {@link modifyRelatedPersonsWithUser} instead.
   */
  modifyRelatedPersons(body: Array<models.RelatedPerson>): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Encrypts and updates multiple related persons.
   * @param user the current user, used for encryption.
   * @param bodies the related persons to update.
   * @return the updated and decrypted related persons.
   */
  async modifyRelatedPersonsWithUser(user: models.User, bodies: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    if (!bodies.length) return []
    const encrypted = await this.encrypt(
      user,
      bodies.map((b) => cloneDeep(b))
    )
    const modified = await super.modifyRelatedPersons(encrypted)
    return this.decrypt(user, modified)
  }

  /**
   * @throws always. Use {@link filterByWithUser} instead.
   */
  filterRelatedPersonsBy(body: models.FilterChainRelatedPerson, startDocumentId?: string, limit?: number, collectTiming?: boolean): never {
    throw new Error('Cannot call a method that returns related persons without providing a user for de/encryption')
  }

  /**
   * Filters related persons using the provided filter chain and decrypts the results.
   * @param user the current user, used for decryption.
   * @param body the filter chain to apply.
   * @param startDocumentId the pagination start document id.
   * @param limit the maximum number of results to return.
   * @param collectTiming add timing information to the response
   * @return a paginated list of decrypted related persons.
   */
  filterByWithUser(
    user: models.User,
    body: models.FilterChainRelatedPerson,
    startDocumentId?: string,
    limit?: number,
    collectTiming?: false
  ): Promise<models.PaginatedListRelatedPerson>
  filterByWithUser(
    user: models.User,
    body: models.FilterChainRelatedPerson,
    startDocumentId?: string,
    limit?: number,
    collectTiming?: true
  ): Promise<models.PaginatedListRelatedPerson & models.TimingInfo>
  async filterByWithUser(
    user: models.User,
    body: models.FilterChainRelatedPerson,
    startDocumentId?: string,
    limit?: number,
    collectTiming: boolean = false
  ): Promise<models.PaginatedListRelatedPerson> {
    const page = await super.filterRelatedPersonsBy(body, startDocumentId, limit, collectTiming as any)
    return Object.assign(page, { rows: await this.decrypt(user, page.rows ?? []) })
  }

  /**
   * Encrypts the encrypted fields of a list of related persons.
   * @param user the current user.
   * @param relatedPersons the related persons to encrypt.
   * @return the encrypted related persons.
   */
  encrypt(user: models.User, relatedPersons: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    return this.doEncrypt(relatedPersons)
  }

  private doEncrypt(relatedPersons: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    return this.crypto.xapi.tryEncryptEntities(
      relatedPersons,
      EntityWithDelegationTypeName.RelatedPerson,
      this.encryptedFields,
      true,
      false,
      (x) => new models.RelatedPerson(x)
    )
  }

  /**
   * Decrypts a list of related persons using the keys of the current data owner. Related persons which can't be decrypted are returned as they
   * are, still encrypted.
   * @param user the current user.
   * @param relatedPersons the related persons to decrypt.
   * @return the decrypted related persons.
   */
  decrypt(user: models.User, relatedPersons: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    return this.doDecrypt(relatedPersons)
  }

  private async doDecrypt(relatedPersons: Array<models.RelatedPerson>): Promise<Array<models.RelatedPerson>> {
    return (
      await this.crypto.xapi.tryDecryptEntities(relatedPersons, EntityWithDelegationTypeName.RelatedPerson, (x) => new models.RelatedPerson(x))
    ).map(({ entity }) => entity)
  }

  /**
   * @return if the logged data owner has write access to the content of the given related person
   */
  async hasWriteAccess(relatedPerson: models.RelatedPerson): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: relatedPerson, type: EntityWithDelegationTypeName.RelatedPerson })
  }

  /**
   * Retrieves the secret ids of a related person. Since a related person is a root entity these secret ids may be used to link other entities to
   * it.
   * @param relatedPerson a related person.
   * @return the secret ids of the provided related person that the current user can access.
   */
  getSecretIdsOf(relatedPerson: models.RelatedPerson): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: relatedPerson, type: EntityWithDelegationTypeName.RelatedPerson }, undefined)
  }

  /**
   * Share an existing related person with other data owners, allowing them to access the non-encrypted data of the related person and optionally
   * also the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the related person.
   * @param relatedPerson the related person to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the related person should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    relatedPerson: models.RelatedPerson,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.RelatedPerson> {
    return this.shareWithMany(relatedPerson, { [delegateId]: options })
  }

  /**
   * Share an existing related person with other data owners, allowing them to access the non-encrypted data of the related person and optionally
   * also the encrypted content, with read-only or read-write permissions.
   * @param relatedPerson the related person to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the related person should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity.
   */
  async shareWithMany(
    relatedPerson: models.RelatedPerson,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.RelatedPerson> {
    return (await this.tryShareWithMany(relatedPerson, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing related person with other data owners, allowing them to access the non-encrypted data of the related person and optionally
   * also the encrypted content, with read-only or read-write permissions.
   * @param relatedPerson the related person to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the related person should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    relatedPerson: models.RelatedPerson,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.RelatedPerson>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(relatedPerson, EntityWithDelegationTypeName.RelatedPerson)
    const updatedEntity = entityWithEncryptionKey ? await this.doModifyRelatedPerson(entityWithEncryptionKey) : relatedPerson
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.RelatedPerson,
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
        (x) => this.bulkShareRelatedPersons(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.doDecrypt([e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: models.RelatedPerson
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.RelatedPerson })
  }

  getEncryptionKeysOf(entity: models.RelatedPerson): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.RelatedPerson }, undefined)
  }

  createDelegationDeAnonymizationMetadata(entity: models.RelatedPerson, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.RelatedPerson },
      delegates
    )
  }

  /**
   * Subscribes to the events of the related persons matching the provided filter. The received related persons are decrypted before being passed to
   * the `eventFired` callback.
   * @param eventTypes the types of events to listen to.
   * @param filter the filter that the related persons must match.
   * @param eventFired the callback executed on each event.
   * @param options the options of the subscription.
   * @return a connection which can be closed to stop the subscription.
   */
  async subscribeToRelatedPersonEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<models.RelatedPerson> | undefined,
    eventFired: (relatedPerson: models.RelatedPerson) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    return await subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.RelatedPerson,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.doDecrypt([encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  /**
   * Like {@link getConflictsForEntity} but additionally decrypts the conflicting revisions for the given user.
   * @param user the current user.
   * @param entityId the id of the related person to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the related person.
   */
  getConflictsForEntityWithUser(user: models.User, entityId: string): Promise<Array<models.RelatedPerson>> {
    return super.getConflictsForEntity(entityId).then((rps) => this.decrypt(user, rps))
  }

  /**
   * Like {@link declareConflictWinner} but encrypts the winning revision before sending it and decrypts the saved
   * winner returned by the backend.
   * @param user the current user.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerWithUser(
    user: models.User,
    request: models.ConflictResolutionRequest<models.RelatedPerson>
  ): Promise<models.ConflictResolutionResult<models.RelatedPerson>> {
    const encrypted = (await this.encrypt(user, [cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinner({ ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(user, [result.document]))[0]
    return result
  }

  /**
   * Like {@link getConflictsForEntityWithUser} but targets the entity of the group with the given id.
   * @param user the current user.
   * @param groupId the id of the group the related person belongs to.
   * @param entityId the id of the related person to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the related person.
   */
  getConflictsForEntityInGroupWithUser(user: models.User, groupId: string, entityId: string): Promise<Array<models.RelatedPerson>> {
    return super.getConflictsForEntityInGroup(groupId, entityId).then((rps) => this.decrypt(user, rps))
  }

  /**
   * Like {@link declareConflictWinnerWithUser} but targets the entity of the group with the given id.
   * @param user the current user.
   * @param groupId the id of the group the related person belongs to.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerInGroupWithUser(
    user: models.User,
    groupId: string,
    request: models.ConflictResolutionRequest<models.RelatedPerson>
  ): Promise<models.ConflictResolutionResult<models.RelatedPerson>> {
    const encrypted = (await this.encrypt(user, [cloneDeep(request.document!)]))[0]
    const result = await super.declareConflictWinnerInGroup(groupId, { ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(user, [result.document]))[0]
    return result
  }
}
