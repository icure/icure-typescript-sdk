import { IccMaintenanceTaskApi } from '../icc-api/api/IccMaintenanceTaskApi'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import { DocIdentifier, MaintenanceTask } from '../icc-api/model/models'
import * as _ from 'lodash'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'

export class IccMaintenanceTaskXApi extends IccMaintenanceTaskApi {
  crypto: IccCryptoXApi
  hcPartyApi: IccHcpartyXApi
  dataOwnerApi: IccDataOwnerXApi

  private readonly encryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    hcPartyApi: IccHcpartyXApi,
    dataOwnerApi: IccDataOwnerXApi,
    encryptedKeys: Array<string> = [],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.hcPartyApi = hcPartyApi
    this.dataOwnerApi = dataOwnerApi
    this.encryptedKeys = encryptedKeys
  }

  /**
   * Creates a new instance of maintenance task with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param m initialised data for the maintenance task. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * @return a new instance of maintenance task.
   */
  async newInstance(
    user: models.User,
    m: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const maintenanceTask = _.assign(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.MaintenanceTask',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: dataOwnerId,
        author: user.id,
      },
      m || {}
    )

    const extraDelegations = [...Object.keys(options.additionalDelegates ?? {}), ...(user.autoDelegations?.all ?? [])]
    return new models.MaintenanceTask(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(maintenanceTask, undefined, undefined, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  createMaintenanceTask(body?: models.MaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  createMaintenanceTaskWithUser(user: models.User, body?: models.MaintenanceTask): Promise<models.MaintenanceTask | null> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((tasks) => super.createMaintenanceTask(tasks[0]))
          .then((mt) => this.decrypt(user, [mt]))
          .then((tasks) => tasks[0])
      : Promise.resolve(null)
  }

  filterMaintenanceTasksBy(startDocumentId?: string, limit?: number, body?: models.FilterChainMaintenanceTask): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  deleteMaintenanceTask(_maintenanceTaskIds: string): never {
    throw new Error('Cannot call a method that returns maintenance tasks without providing a user for de/encryption')
  }

  deleteMaintenanceTaskWithUser(user: models.User, maintenanceTaskId: string): Promise<Array<DocIdentifier>> | never {
    return super.deleteMaintenanceTask(maintenanceTaskId)
  }

  filterMaintenanceTasksByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChainMaintenanceTask
  ): Promise<models.PaginatedListMaintenanceTask> {
    return super
      .filterMaintenanceTasksBy(startDocumentId, limit, body)
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
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }

  private modifyAs(dataOwner: string, body: models.MaintenanceTask): Promise<models.MaintenanceTask | any> {
    return this.encryptAs(dataOwner, [_.cloneDeep(body)])
      .then((encTasks) => super.modifyMaintenanceTask(encTasks[0]))
      .then((mt) => this.decryptAs(dataOwner, [mt]))
      .then((mts) => mts[0])
  }

  encrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), maintenanceTasks)
  }

  private encryptAs(dataOwnerId: string, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return Promise.all(
      maintenanceTasks.map((m) =>
        this.crypto.entities.tryEncryptEntity(m, dataOwnerId, this.encryptedKeys, true, true, (x) => new models.MaintenanceTask(x))
      )
    )
  }

  decrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return this.decryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), maintenanceTasks)
  }
  private decryptAs(dataOwnerId: string, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    return Promise.all(
      maintenanceTasks.map(async (mT) =>
        this.crypto.entities.decryptEntity(mT, dataOwnerId, (x) => new MaintenanceTask(x)).then(({ entity }) => entity)
      )
    )
  }

  /**
   * Share an existing maintenance task with other data owners, allowing them to access the non-encrypted data of the maintenance task and optionally also
   * the encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the maintenance task.
   * @param maintenanceTask the maintenance task to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * maintenance task does not have encrypted content.
   * @return a promise which will contain the updated maintenance task
   */
  async shareWith(
    delegateId: string,
    maintenanceTask: models.MaintenanceTask,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.MaintenanceTask> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    return await this.modifyAs(
      self,
      await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
        maintenanceTask,
        delegateId,
        undefined,
        options.shareEncryptionKey,
        ShareMetadataBehaviour.IF_AVAILABLE
      )
    )
  }
}
