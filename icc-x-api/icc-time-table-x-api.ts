import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import { IccTimeTableApi } from '../icc-api'
import { User } from '../icc-api/model/User'
import { TimeTable } from '../icc-api/model/TimeTable'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import * as models from '../icc-api/model/models'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

export class IccTimeTableXApi extends IccTimeTableApi implements EncryptedEntityXApi<models.TimeTable> {
  i18n: any = i18n
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, 'TimeTable'))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.crypto = crypto
    this.dataOwnerApi = dataOwnerApi
  }

  /**
   * Creates a new instance of timetable with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param tt initialised data for the timetable. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * @return a new instance of timetable.
   */
  async newInstance(
    user: User,
    tt: TimeTable,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ) {
    const timeTable = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.TimeTable',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      tt || {}
    )
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.TimeTable(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(timeTable, 'TimeTable', undefined, undefined, true, false, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  /**
   * @return if the logged data owner has write access to the content of the given time table
   */
  async hasWriteAccess(timeTable: models.TimeTable): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: timeTable, type: 'TimeTable' })
  }

  /**
   * Share an existing time table with other data owners, allowing them to access the non-encrypted data of the time table and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the time table.
   * @param timeTable the time table to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * time table does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    timeTable: models.TimeTable,
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.TimeTable> {
    return this.shareWithMany(timeTable, { [delegateId]: options })
  }

  /**
   * Share an existing time table with other data owners, allowing them to access the non-encrypted data of the time table and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param timeTable the time table to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * time table does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    timeTable: models.TimeTable,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.TimeTable> {
    return (await this.tryShareWithMany(timeTable, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing time table with other data owners, allowing them to access the non-encrypted data of the time table and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param timeTable the time table to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * time table does not have encrypted content.
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    timeTable: models.TimeTable,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.TimeTable>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(timeTable, 'TimeTable')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyTimeTable(entityWithEncryptionKey) : timeTable
    return this.crypto.xapi.simpleShareOrUpdateEncryptedEntityMetadata(
      { entity: updatedEntity, type: 'TimeTable' },
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
      (x) => this.bulkShareTimeTable(x)
    )
  }

  getDataOwnersWithAccessTo(
    entity: models.TimeTable
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.xapi.getDataOwnersWithAccessTo({ entity, type: 'TimeTable' })
  }

  getEncryptionKeysOf(entity: models.TimeTable): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: 'TimeTable' }, undefined)
  }
}
