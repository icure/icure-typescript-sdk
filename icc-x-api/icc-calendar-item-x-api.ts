import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { CalendarItem, User } from '../icc-api/model/models'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccCalendarItemApi } from '../icc-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccCalendarItemXApi extends IccCalendarItemApi {
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

  newInstance(user: User, ci: CalendarItem, delegates: string[] = []) {
    return this.newInstancePatient(user, null, ci, delegates)
  }

  async newInstancePatient(
    user: models.User,
    patient: models.Patient | null,
    ci: any,
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ): Promise<models.CalendarItem> {
    if (!patient && preferredSfk) throw new Error('You need to specify parent patient in order to use secret foreign keys.')
    const calendarItem = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.CalendarItem',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      ci || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const sfk = patient ? preferredSfk ?? (await this.crypto.entities.secretIdsOf(patient, ownerId))[0] : undefined
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new CalendarItem(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(calendarItem, patient?.id, sfk, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0] // TODO should this really be topmost parent?
    return extractedKeys && extractedKeys.length > 0
      ? this.findByHCPartyPatientSecretFKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }

  async findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.CalendarItem>> {
    const calendarItems = await super.findCalendarItemsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys)
    return await this.decrypt(hcPartyId, calendarItems)
  }

  createCalendarItem(body?: CalendarItem): never {
    throw new Error('Cannot call a method that must encrypt a calendar item without providing a user for de/encryption')
  }

  async createCalendarItemWithHcParty(user: models.User, body?: models.CalendarItem): Promise<models.CalendarItem | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((items) => super.createCalendarItem(items[0]))
          .then((ci) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [ci]))
          .then((cis) => cis[0])
      : null
  }

  getCalendarItemWithUser(user: models.User, calendarItemId: string): Promise<CalendarItem | any> {
    return super
      .getCalendarItem(calendarItemId)
      .then((calendarItem) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [calendarItem]))
      .then((cis) => cis[0])
  }

  getCalendarItem(calendarItemId: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsWithUser(user: models.User): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItems().then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, calendarItems))
  }

  getCalendarItems(): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsWithIdsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItemsWithIds(body).then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, calendarItems))
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
      .then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, calendarItems))
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
      .then((calendarItems) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, calendarItems))
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
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((items) => super.modifyCalendarItem(items[0]))
          .then((ci) => this.decrypt(this.dataOwnerApi.getDataOwnerOf(user)!, [ci]))
          .then((cis) => cis[0])
      : null
  }

  encrypt(user: models.User, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    const owner = this.dataOwnerApi.getDataOwnerOf(user)
    return Promise.all(
      calendarItems.map((x) => this.crypto.entities.encryptEntity(x, owner, this.encryptedKeys, false, (json) => new CalendarItem(json)))
    )
  }

  decrypt(hcpId: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(calendarItems.map((x) => this.crypto.entities.decryptEntity(x, hcpId, (json) => new CalendarItem(json))))
  }
}
