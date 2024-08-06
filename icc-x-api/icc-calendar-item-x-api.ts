import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import {CalendarItem, Connection, ConnectionImpl, User} from '../icc-api/model/models'
import { IccCryptoXApi } from './icc-crypto-x-api'
import {IccAuthApi, IccCalendarItemApi} from '../icc-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import { XHR } from '../icc-api/api/XHR'
import {EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions} from './utils'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { PaginatedListCalendarItem } from '../icc-api/model/PaginatedListCalendarItem'
import {AbstractFilter} from "./filters/filters"
import {IccUserXApi} from "./icc-user-x-api"

export class IccCalendarItemXApi extends IccCalendarItemApi implements EncryptedEntityXApi<models.CalendarItem> {
  i18n: any = i18n
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.CalendarItem))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly userApi: IccUserXApi,
    private readonly authApi: IccAuthApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly autofillAuthor: boolean,
    encryptedKeys: Array<string> = ['details', 'title', 'patientId'],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'CalendarItem.')
  }

  newInstance(
    user: User,
    ci: any | CalendarItem,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
    } = {}
  ) {
    return this.newInstancePatient(user, null, ci, options)
  }

  /**
   * Creates a new instance of calendar item with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this calendar item refers to.
   * @param ci initialised data for the calendar item. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the classcalendar itemification. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of calendar item.
   */
  async newInstancePatient(
    user: models.User,
    patient: models.Patient | null,
    ci: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ): Promise<models.CalendarItem> {
    if (!patient && options.preferredSfk) throw new Error('You need to specify parent patient in order to use secret foreign keys.')
    const calendarItem = {
      ...(ci ?? {}),
      _type: 'org.taktik.icure.entities.CalendarItem',
      id: ci?.id ?? this.crypto.primitives.randomUuid(),
      created: ci?.created ?? new Date().getTime(),
      modified: ci?.modified ?? new Date().getTime(),
      responsible: ci?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: ci?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: ci?.codes ?? [],
      tags: ci?.tags ?? [],
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient
      ? options?.preferredSfk ??
        (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient }))
      : undefined
    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new CalendarItem(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          calendarItem,
          EntityWithDelegationTypeName.CalendarItem,
          patient?.id,
          sfk,
          true,
          false,
          extraDelegations
        )
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? usingPost
        ? this.findByHCPartyPatientSecretFKeysArray(hcpartyId!, _.uniq(extractedKeys))
        : this.findByHCPartyPatientSecretFKeys(hcpartyId!, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }

  async findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.CalendarItem>> {
    const calendarItems = await super.findCalendarItemsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys)
    return await this.decrypt(hcPartyId, calendarItems)
  }

  findByHCPartyPatientSecretFKeysArray(hcPartyId: string, secretFKeys: string[]): Promise<Array<models.CalendarItem> | any> {
    return super
      .findCalendarItemsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys)
      .then((calendarItems) => this.decrypt(hcPartyId, calendarItems))
  }

  createCalendarItem(body?: CalendarItem): never {
    throw new Error('Cannot call a method that must encrypt a calendar item without providing a user for de/encryption')
  }

  async createCalendarItemWithHcParty(user: models.User, body?: models.CalendarItem): Promise<models.CalendarItem | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((items) => super.createCalendarItem(items[0]))
          .then((ci) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [ci]))
          .then((cis) => cis[0])
      : null
  }

  getCalendarItemWithUser(user: models.User, calendarItemId: string): Promise<CalendarItem | any> {
    return super
      .getCalendarItem(calendarItemId)
      .then((calendarItem) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, [calendarItem]))
      .then((cis) => cis[0])
  }

  getCalendarItem(calendarItemId: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  /**
   * @deprecated use {@link getCalendarItemsWithPaginationWithUser} instead.
   */
  async getCalendarItemsWithUser(user: models.User): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItems().then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  getCalendarItems(): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  async getCalendarItemsWithPaginationWithUser(user: models.User, startDocumentId?: string, limit?: number): Promise<PaginatedListCalendarItem> {
    return super.getCalendarItemsWithPagination(startDocumentId, limit).then((calendarItems) =>
      this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems.rows ?? []).then(
        (decryptedItems) =>
          new PaginatedListCalendarItem({
            rows: decryptedItems,
            nextKeyPair: calendarItems.nextKeyPair,
          })
      )
    )
  }

  getCalendarItemsWithPagination(startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  /**
   * @deprecated use {@link findCalendarItemsByRecurrenceIdWithPaginationWithUser} instead.
   */
  async findCalendarItemsByRecurrenceIdWithUser(user: models.User, recurrenceId: string): Promise<Array<CalendarItem> | any> {
    return super
      .findCalendarItemsByRecurrenceId(recurrenceId)
      .then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  findCalendarItemsByRecurrenceId(recurrenceId: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  async findCalendarItemsByRecurrenceIdWithPaginationWithUser(
    user: models.User,
    recurrenceId: string,
    startKey?: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListCalendarItem> {
    return super.findCalendarItemsByRecurrenceIdWithPagination(recurrenceId, startKey, startDocumentId, limit).then((calendarItems) =>
      this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems.rows ?? []).then(
        (decryptedItems) =>
          new PaginatedListCalendarItem({
            rows: decryptedItems,
            nextKeyPair: calendarItems.nextKeyPair,
          })
      )
    )
  }

  findCalendarItemsByRecurrenceIdWithPagination(recurrenceId: string, startKey?: string, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsWithIdsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItemsWithIds(body).then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  getCalendarItemsWithIds(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsByPeriodAndHcPartyIdWithUser(
    user: models.User,
    startDate: number,
    endDate: number,
    hcPartyId: string
  ): Promise<Array<CalendarItem> | any> {
    return super
      .getCalendarItemsByPeriodAndHcPartyId(startDate, endDate, hcPartyId)
      .then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  getCalendarItemsByPeriodAndHcPartyId(startDate?: number, endDate?: number, hcPartyId?: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarsByPeriodAndAgendaIdWithUser(
    user: models.User,
    startDate: number,
    endDate: number,
    agendaId: string
  ): Promise<Array<CalendarItem> | any> {
    return super
      .getCalendarsByPeriodAndAgendaId(startDate, endDate, agendaId)
      .then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  getCalendarsByPeriodAndAgendaId(startDate?: number, endDate?: number, agendaId?: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  modifyCalendarItem(body?: CalendarItem): never {
    throw new Error('Cannot call a method that must encrypt a calendar item without providing a user for de/encryption')
  }

  /**
   * Remove the following delegation objects from the
   * CalendarItem instance: cryptedForeignKeys, secretForeignKeys.
   *
   * The delegations & encryptionKeys objects are not removed because
   * in the case the CalendarItem is saved in the DB & then encrypted,
   * if later we remove the patient from it, it'd reset the delegations
   * and encryptionKeys thus impossibilitating further access.
   *
   * @param calendarItem The Calendar Item object
   */
  resetCalendarDelegationObjects(calendarItem: models.CalendarItem): models.CalendarItem {
    const { cryptedForeignKeys, secretForeignKeys, ...resetCalendarItem } = calendarItem
    return resetCalendarItem
  }

  async modifyCalendarItemWithHcParty(user: models.User, body?: models.CalendarItem): Promise<models.CalendarItem | any> {
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, _.cloneDeep(body)) : null
  }

  private modifyAs(dataOwner: string, body: models.CalendarItem): Promise<models.CalendarItem> {
    return this.encryptAs(dataOwner, [_.cloneDeep(body)])
      .then((items) => super.modifyCalendarItem(items[0]))
      .then((ci) => this.decrypt(dataOwner, [ci]))
      .then((cis) => cis[0])
  }

  encrypt(user: models.User, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems)
  }

  private encryptAs(dataOwner: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(
      calendarItems.map((x) =>
        this.crypto.xapi.tryEncryptEntity(
          x,
          EntityWithDelegationTypeName.CalendarItem,
          this.encryptedFields,
          false,
          false,
          (json) => new CalendarItem(json)
        )
      )
    )
  }

  decrypt(hcpId: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(
      calendarItems.map((x) =>
        this.crypto.xapi.decryptEntity(x, EntityWithDelegationTypeName.CalendarItem, (json) => new CalendarItem(json)).then(({ entity }) => entity)
      )
    )
  }

  /**
   * @param calendarItem a calendar item
   * @return the id of the patient that the calendar item refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(calendarItem: models.CalendarItem): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: calendarItem, type: EntityWithDelegationTypeName.CalendarItem }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given calendar item
   */
  async hasWriteAccess(calendarItem: models.CalendarItem): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: calendarItem, type: EntityWithDelegationTypeName.CalendarItem })
  }

  /**
   * Share an existing calendar item with other data owners, allowing them to access the non-encrypted data of the calendar item and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the calendar item.
   * @param calendarItem item the calendar item to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * calendar item does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this calendar item refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async shareWith(
    delegateId: string,
    calendarItem: models.CalendarItem,
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.CalendarItem> {
    return this.shareWithMany(calendarItem, { [delegateId]: options })
  }

  /**
   * Share an existing calendar item with other data owners, allowing them to access the non-encrypted data of the calendar item and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param calendarItem item the calendar item to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * calendar item does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this calendar item refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    calendarItem: models.CalendarItem,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.CalendarItem> {
    return (await this.tryShareWithMany(calendarItem, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing calendar item with other data owners, allowing them to access the non-encrypted data of the calendar item and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param calendarItem item the calendar item to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * calendar item does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this calendar item refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async tryShareWithMany(
    calendarItem: models.CalendarItem,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.CalendarItem>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(calendarItem, EntityWithDelegationTypeName.CalendarItem)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyAs(self, entityWithEncryptionKey) : calendarItem
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        { entity: updatedEntity, type: EntityWithDelegationTypeName.CalendarItem },
        true,
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: undefined,
            },
          ])
        ),
        (x) => this.bulkShareCalendarItems(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: CalendarItem
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.CalendarItem })
  }

  getEncryptionKeysOf(entity: CalendarItem): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.CalendarItem }, undefined)
  }

  /**
   * Links a calendar item with a patient. Note that this operation is not reversible: it is not possible to change the patient linked to a calendar
   * item.
   * @param calendarItem a calendar item
   * @param patient the patient which will be linked to the calendar item.
   * @param shareLinkWithDelegates data owners other than the current data owner which will also be able to decrypt the id of the newly linked
   * patient. If any of these data owners do not already have access to the calendar item, they will be granted read access (no write).
   * @return the updated calendar item
   */
  async linkToPatient(calendarItem: models.CalendarItem, patient: models.Patient, shareLinkWithDelegates: string[]): Promise<models.CalendarItem> {
    if (!!calendarItem.secretForeignKeys?.length) throw new Error(`Calendar item ${calendarItem.id} is already linked to a patient`)
    const delegates = [...new Set([await this.dataOwnerApi.getCurrentDataOwnerId(), ...shareLinkWithDelegates])]
    const sfk = await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient })
    if (!sfk) {
      throw new Error(`Could not find any secret id for patient ${patient.id} which is shared with the topmost ancestor of the current data owner`)
    }
    const individualShareData = {
      shareSecretIds: [] as string[],
      shareEncryptionKeys: [] as string[],
      shareOwningEntityIds: [patient.id!],
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    }
    const shared = await this.crypto.xapi.bulkShareOrUpdateEncryptedEntityMetadata(
      EntityWithDelegationTypeName.CalendarItem,
      [
        {
          entity: calendarItem,
          dataForDelegates: Object.fromEntries(delegates.map((d) => [d, individualShareData])),
        },
      ],
      (x) => this.bulkShareCalendarItems(x)
    )
    if (!shared.updatedEntities.length || shared.updatedEntities[0].id !== calendarItem.id) {
      const errorsForEntity = shared.updateErrors.filter((e) => e.entityId === calendarItem.id)
      if (!errorsForEntity.length || !errorsForEntity.find((x) => x.code === 409)) {
        throw new Error(`Unexpected error while linking calendar item ${calendarItem.id}`)
      } else {
        throw new Error(`Outdated calendar item revision ${calendarItem.id}-${calendarItem.rev}`)
      }
    }
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const sharedDecrypted = (await this.decrypt(self, [shared.updatedEntities[0]]))[0]
    const withSfk = await this.modifyAs(self, { ...sharedDecrypted, secretForeignKeys: [sfk] })
    return (await this.decrypt(self, [withSfk]))[0]
  }

  async subscribeToCalendarItemEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<CalendarItem>,
    eventFired: (dataSample: CalendarItem) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const currentUser = await this.userApi.getCurrentUser()
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(currentUser)

    return subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.CalendarItem,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted: CalendarItem) => (await this.decrypt(dataOwnerId, [encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  createDelegationDeAnonymizationMetadata(entity: CalendarItem, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.CalendarItem },
      delegates
    )
  }
}
