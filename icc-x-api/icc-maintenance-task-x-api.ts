import { IccMaintenanceTaskApi } from '../icc-api/api/IccMaintenanceTaskApi'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { cloneDeep } from './utils/collection-utils'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { DocIdentifier, ListOfIds, MaintenanceTask, TimingInfo } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { SecretIdShareOptions } from './crypto/ShareSecretIdOptions'
import { ShareResult } from './utils/ShareResult'
import { ShareByIdResult } from './utils/ShareByIdResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { IccAuthApi } from '../icc-api'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { AbstractFilter } from './filters/filters'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { IccUserXApi } from './icc-user-x-api'

export class IccMaintenanceTaskXApi extends IccMaintenanceTaskApi implements EncryptedEntityXApi<models.MaintenanceTask> {
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) =>
      this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.MaintenanceTask)
    )
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly hcPartyApi: IccHcpartyXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly userApi: IccUserXApi,
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
    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'MaintenanceTask.')
  }

  /**
   * Creates a new instance of maintenance task with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param m initialised data for the maintenance task. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of maintenance task.
   */
  async newInstance(
    user: models.User,
    m: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const maintenanceTask = {
      ...(m ?? {}),
      _type: 'org.taktik.icure.entities.MaintenanceTask',
      id: m?.id ?? this.crypto.primitives.randomUuid(),
      created: m?.created ?? new Date().getTime(),
      modified: m?.modified ?? new Date().getTime(),
      responsible: m?.responsible ?? (this.autofillAuthor ? dataOwnerId : undefined),
      author: m?.author ?? (this.autofillAuthor ? user.id : undefined),
    }

    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true ? {} : Object.fromEntries((user.autoDelegations?.all ?? []).map((d) => [d, AccessLevelEnum.WRITE]))),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.MaintenanceTask(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          maintenanceTask,
          EntityWithDelegationTypeName.MaintenanceTask,
          undefined,
          undefined,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
        .then((x) => x.updatedEntity)
    )
  }

  createMaintenanceTask(body?: models.MaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  createMaintenanceTaskWithUser(user: models.User, body?: models.MaintenanceTask): Promise<models.MaintenanceTask | null> {
    return body
      ? this.encrypt(user, [cloneDeep(body)])
          .then((tasks) => super.createMaintenanceTask(tasks[0]))
          .then((mt) => this.decrypt(user, [mt]))
          .then((tasks) => tasks[0])
      : Promise.resolve(null)
  }

  filterMaintenanceTasksBy(startDocumentId?: string, limit?: number, body?: models.FilterChainMaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  deleteMaintenanceTask(_maintenanceTaskId: string): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  deleteMaintenanceTaskWithUser(user: models.User, maintenanceTaskId: string): Promise<DocIdentifier> | never {
    return super.deleteMaintenanceTask(maintenanceTaskId)
  }

  deleteMaintenanceTasks(_maintenanceTaskIds: ListOfIds): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  deleteMaintenanceTasksWithUser(user: models.User, maintenanceTaskIds: ListOfIds): Promise<Array<DocIdentifier>> | never {
    return super.deleteMaintenanceTasks(maintenanceTaskIds)
  }

  filterMaintenanceTasksByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChainMaintenanceTask,
    collectTiming?: false
  ): Promise<models.PaginatedListMaintenanceTask>
  filterMaintenanceTasksByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChainMaintenanceTask,
    collectTiming?: true
  ): Promise<models.PaginatedListMaintenanceTask & TimingInfo>
  filterMaintenanceTasksByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChainMaintenanceTask,
    collectTiming: boolean = false
  ): Promise<models.PaginatedListMaintenanceTask> {
    return super
      .filterMaintenanceTasksBy(startDocumentId, limit, body, collectTiming as any)
      .then((pl) => this.decrypt(user, pl.rows!).then((dr) => Object.assign(pl, { rows: dr })))
  }

  getMaintenanceTask(maintenanceTaskId: string): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  getMaintenanceTaskWithUser(user: models.User, maintenanceTaskId: string): Promise<models.MaintenanceTask | any> {
    return super
      .getMaintenanceTask(maintenanceTaskId)
      .then((mt) => this.decrypt(user, [mt]))
      .then((mts) => mts[0])
  }

  modifyMaintenanceTask(body?: models.MaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  modifyMaintenanceTaskWithUser(user: models.User, body?: models.MaintenanceTask): Promise<models.MaintenanceTask | any> {
    return body ? this.modifyMaintenanceTaskAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }

  private modifyMaintenanceTaskAs(dataOwner: string, body: models.MaintenanceTask): Promise<models.MaintenanceTask> {
    return this.encryptAs(dataOwner, [cloneDeep(body)])
      .then((encTasks) => super.modifyMaintenanceTask(encTasks[0]))
      .then((mt) => this.decryptAs(dataOwner, [mt]))
      .then((mts) => mts[0])
  }

  encrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.encryptAs(dataOwnerId, maintenanceTasks)
  }

  private encryptAs(dataOwner: string, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return this.crypto.xapi.tryEncryptEntities(
      maintenanceTasks,
      EntityWithDelegationTypeName.MaintenanceTask,
      this.encryptedFields,
      true,
      false,
      (x) => new models.MaintenanceTask(x)
    )
  }

  decrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    return this.decryptAs(dataOwnerId, maintenanceTasks)
  }

  private async decryptAs(dataOwner: string, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return (
      await this.crypto.xapi.tryDecryptEntities(maintenanceTasks, EntityWithDelegationTypeName.MaintenanceTask, (x) => new MaintenanceTask(x))
    ).map(({ entity }) => entity)
  }

  /**
   * @return if the logged data owner has write access to the content of the given maintenance task
   */
  async hasWriteAccess(maintenanceTask: models.MaintenanceTask): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: maintenanceTask, type: EntityWithDelegationTypeName.MaintenanceTask })
  }

  /**
   * Share an existing maintenance task with other data owners, allowing them to access the non-encrypted data of the maintenance task and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the maintenance task.
   * @param maintenanceTask the maintenance task to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * maintenance task does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    maintenanceTask: models.MaintenanceTask,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.MaintenanceTask> {
    return this.shareWithMany(maintenanceTask, { [delegateId]: options })
  }

  /**
   * Share an existing maintenance task with other data owners, allowing them to access the non-encrypted data of the maintenance task and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param maintenanceTask the maintenance task to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * maintenance task does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity.
   */
  async shareWithMany(
    maintenanceTask: models.MaintenanceTask,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.MaintenanceTask> {
    return (await this.tryShareWithMany(maintenanceTask, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing maintenance task with other data owners, allowing them to access the non-encrypted data of the maintenance task and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param maintenanceTask the maintenance task to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * maintenance task does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    maintenanceTask: models.MaintenanceTask,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.MaintenanceTask>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(
      maintenanceTask,
      EntityWithDelegationTypeName.MaintenanceTask
    )
    const updatedEntity = entityWithEncryptionKey ? await this.modifyMaintenanceTaskAs(self, entityWithEncryptionKey) : maintenanceTask
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.MaintenanceTask,
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
        (x) => this.bulkShareMaintenanceTask(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decryptAs(self, [e]).then((es) => es[0])))
  }

  /**
   * Shares the maintenance tasks with the provided ids with one or more delegates, using the same share options for all of
   * them.
   *
   * Unlike {@link shareWith} this method does not need the decrypted maintenance tasks, does not return them, and does not
   * fail because of a single maintenance task or delegate: the outcome of each (maintenance task, delegate) pair is reported in
   * the returned {@link ShareByIdResult}. Ids of maintenance tasks that don't exist or that the current user can't read are
   * reported in {@link ShareByIdResult.notFoundIds} and are otherwise ignored.
   * @param ids the ids of the maintenance tasks to share. Duplicates are ignored.
   * @param delegates associates the id of the data owners which will be granted access to the maintenance tasks to the
   * following sharing options:
   * - shareSecretIds specifies which secret ids of each of the maintenance tasks should be shared: with
   * {@link SecretIdShareOptions.AllAvailable} (the default) each of them is shared with all the secret ids of that entity
   * that the current data owner can access, with {@link SecretIdShareOptions.UseExactly} they are all shared with exactly
   * the provided secret ids.
   * - requestedPermissions requested permissions for the delegate. Defaults to
   * {@link RequestedPermissionEnum.MAX_WRITE}.
   * - shareEncryptionKey specifies if the encryption key of the maintenance tasks should be shared: this is needed for the
   * delegate to be able to decrypt their content. Defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * @return a promise which will be completed with the outcome of the operation for each (maintenance task, delegate) pair.
   */
  async shareById(
    ids: string[],
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: SecretIdShareOptions // Defaults to all available without being required
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
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
            shareOwningEntityIds: ShareMetadataBehaviour.NEVER,
          },
        ])
      ),
      EntityWithDelegationTypeName.MaintenanceTask,
      (x) => this.findMaintenanceTasksDelegationsStubsByIds(x),
      (x) => this.bulkShareMaintenanceTaskMinimal(x)
    )
  }

  getDataOwnersWithAccessTo(
    entity: models.MaintenanceTask
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.MaintenanceTask })
  }

  getEncryptionKeysOf(entity: models.MaintenanceTask): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.MaintenanceTask }, undefined)
  }

  async subscribeToMaintenanceTaskEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<MaintenanceTask>,
    eventFired: (dataSample: MaintenanceTask) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const currentUser = await this.userApi.getCurrentUser()

    return subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.MaintenanceTask,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt(currentUser, [encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  createDelegationDeAnonymizationMetadata(entity: MaintenanceTask, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.MaintenanceTask },
      delegates
    )
  }
}
