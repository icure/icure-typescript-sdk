import { IccMaintenanceTaskApi } from '../icc-api/api/IccMaintenanceTaskApi'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as models from '../icc-api/model/models'
import * as _ from 'lodash'
import { a2b, b2a, string2ua } from '../icc-api/model/ModelHelper'
import { hex2ua, ua2utf8, utf8_2ua, crypt } from './utils'
import { IccHcpartyXApi } from './icc-hcparty-x-api'
import { DocIdentifier, MaintenanceTask } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

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
   * @param delegates initial delegates which will have access to the maintenance task other than the current data owner.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of maintenance task.
   */
  async newInstance(user: models.User, m: any, delegates: string[] = [], delegationTags?: string[]) {
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

    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? [])]
    return new models.MaintenanceTask(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(maintenanceTask, undefined, undefined, true, extraDelegations, delegationTags)
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
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((encTasks) => super.modifyMaintenanceTask(encTasks[0]))
          .then((mt) => this.decrypt(user, [mt]))
          .then((mts) => mts[0])
      : Promise.resolve(null)
  }

  encrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)

    return Promise.all(
      maintenanceTasks.map((m) => this.crypto.entities.encryptEntity(m, dataOwnerId, this.encryptedKeys, true, (x) => new models.MaintenanceTask(x)))
    )
  }

  decrypt(user: models.User, maintenanceTasks: Array<models.MaintenanceTask>): Promise<Array<models.MaintenanceTask>> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)

    return Promise.all(maintenanceTasks.map(async (mT) => this.crypto.entities.decryptEntity(mT, dataOwnerId, (x) => new MaintenanceTask(x))))
  }
}
