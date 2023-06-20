import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { CalendarItem, User } from '../icc-api/model/models'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccCalendarItemApi } from '../icc-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

export class IccCalendarItemXApi extends IccCalendarItemApi implements EncryptedEntityXApi<models.CalendarItem> {
  i18n: any = i18n
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi
  encryptedKeys = ['details', 'title', 'patientId']

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    encryptedKeys: Array<string> = ['details', 'title', 'patientId'],
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
    this.encryptedKeys = encryptedKeys
  }

  newInstance(user: User, ci: CalendarItem, options: { additionalDelegates?: { [dataOwnerId: string]: 'WRITE' } } = {}) {
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
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the access log. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of calendar item.
   */
  async newInstancePatient(
    user: models.User,
    patient: models.Patient | null,
    ci: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
      preferredSfk?: string
    } = {}
  ): Promise<models.CalendarItem> {
    if (!patient && options.preferredSfk) throw new Error('You need to specify parent patient in order to use secret foreign keys.')
    const calendarItem = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.CalendarItem',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      ci || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient ? options.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient)) : undefined
    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(user.autoDelegations?.all ?? []),
      ...(user.autoDelegations?.medicalInformation ?? []),
    ]
    return new CalendarItem(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(calendarItem, patient?.id, sfk, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? usingPost
        ? await this.findByHCPartyPatientSecretFKeysArray(topmostParentId, _.uniq(extractedKeys))
        : await this.findByHCPartyPatientSecretFKeys(topmostParentId, _.uniq(extractedKeys).join(','))
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

  getCalendarItemsWithUser(user: models.User): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItems().then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems))
  }

  getCalendarItems(): never {
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
      .then((als) => super.modifyCalendarItem(als[0]))
      .then((body) => this.decrypt(dataOwner, [body]))
      .then((als) => als[0])
  }

  encrypt(user: models.User, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user)!, calendarItems)
  }

  private encryptAs(dataOwnerId: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(
      calendarItems.map((x) =>
        this.crypto.entities.tryEncryptEntity(x, dataOwnerId, this.encryptedKeys, false, true, (json) => new CalendarItem(json))
      )
    )
  }

  decrypt(hcpId: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(
      calendarItems.map((x) => this.crypto.entities.decryptEntity(x, hcpId, (json) => new CalendarItem(json)).then(({ entity }) => entity))
    )
  }

  /**
   * @param calendarItem a calendar item
   * @return the id of the patient that the calendar item refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(calendarItem: models.CalendarItem): Promise<string[]> {
    return this.crypto.entities.owningEntityIdsOf(calendarItem, undefined)
  }

  /**
   * Share an existing calendar item with other data owners, allowing them to access the non-encrypted data of the calendar item and optionally also
   * the encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the calendar item.
   * @param calendarItem item the calendar item to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * calendar item does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this calendar item refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated entity.
   */
  async shareWith(
    delegateId: string,
    calendarItem: models.CalendarItem,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.CalendarItem> {
    return this.shareWithMany(calendarItem, { [delegateId]: options })
  }
  /**
   * Share an existing calendar item with other data owners, allowing them to access the non-encrypted data of the calendar item and optionally also
   * the encrypted content.
   * @param calendarItem item the calendar item to share.
   * @param delegates sharing options for each delegate.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * calendar item does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this calendar item refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated entity.
   */
  async shareWithMany(
    calendarItem: models.CalendarItem,
    delegates: {
      [delegateId: string]: {
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.CalendarItem> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const extended = await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
      calendarItem,
      true,
      Object.fromEntries(
        Object.entries(delegates).map(([delegateId, options]) => [
          delegateId,
          {
            shareEncryptionKey: options.shareEncryptionKey,
            shareOwningEntityIds: options.sharePatientId,
          },
        ])
      )
    )
    if (!!extended) {
      return await this.modifyAs(self, extended)
    } else return calendarItem
  }

  async getDataOwnersWithAccessTo(
    entity: CalendarItem
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: 'WRITE' }; hasUnknownAnonymousDataOwners: boolean }> {
    return await this.crypto.entities.getDataOwnersWithAccessTo(entity)
  }

  async getEncryptionKeysOf(entity: CalendarItem): Promise<string[]> {
    return await this.crypto.entities.encryptionKeysOf(entity)
  }

  /**
   * Links a calendar item with a patient. Note that this operation is not reversible: it is not possible to change the patient linked to a calendar
   * item.
   * @param calendarItem a calendar item
   * @param patient the patient which will be linked to the calendar item
   * @param shareLinkWithDelegates data owners other than the current data owner which will also be able to decrypt the id of the newly linked patient
   * @return the updated calendar item
   */
  async linkToPatient(calendarItem: models.CalendarItem, patient: models.Patient, shareLinkWithDelegates: string[]): Promise<models.CalendarItem> {
    if (!!calendarItem.secretForeignKeys?.length) throw new Error(`Calendar item ${calendarItem.id} is already linked to a patient`)
    const delegates = [...new Set([await this.dataOwnerApi.getCurrentDataOwnerId(), ...shareLinkWithDelegates])]
    const sfk = await this.crypto.confidential.getAnySecretIdSharedWithParents(patient)
    if (!sfk) {
      throw new Error(`Could not find any secret id for patient ${patient.id} which is shared with the topmost ancestor of the current data owner`)
    }
    let updated = {
      ...calendarItem,
      secretForeignKeys: [sfk],
    }
    for (const delegate of delegates) {
      updated = (await this.crypto.entities.entityWithExtendedEncryptedMetadata(updated, delegate, [], [], [patient.id!])) ?? updated
    }
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const saved = await this.modifyAs(self, updated)
    return (await this.decrypt(self, [saved]))[0]
  }
}
