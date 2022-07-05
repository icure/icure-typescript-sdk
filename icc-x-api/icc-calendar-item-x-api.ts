import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { CalendarItem, User } from '../icc-api/model/models'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccCalendarItemApi } from '../icc-api'
import { crypt, decrypt, hex2ua, ua2utf8, utf8_2ua } from './utils'
import { IccUserXApi } from './icc-user-x-api'

export class IccCalendarItemXApi extends IccCalendarItemApi {
  i18n: any = i18n
  crypto: IccCryptoXApi
  userApi: IccUserXApi
  encryptedKeys = ['details', 'title', 'patientId']

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    encryptedKeys: Array<string> = ['details', 'title', 'patientId'],
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
    this.encryptedKeys = encryptedKeys
  }

  newInstance(user: User, ci: CalendarItem, delegates: string[] = []) {
    return this.newInstancePatient(user, null, ci, delegates)
  }

  newInstancePatient(user: models.User, patient: models.Patient | null, ci: any, delegates: string[] = []): Promise<models.CalendarItem> {
    const calendarItem = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.CalendarItem',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.userApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      ci || {}
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, calendarItem, delegates)
  }

  initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient | null,
    calendarItem: models.CalendarItem,
    delegates: string[] = []
  ): Promise<models.CalendarItem> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto.extractDelegationsSFKs(patient, dataOwnerId!).then(async (secretForeignKeys) => {
      const dels = await this.crypto.initObjectDelegations(calendarItem, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0])
      const eks = await this.crypto.initEncryptionKeys(calendarItem, dataOwnerId!)

      _.extend(calendarItem, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys,
      })

      let promise = Promise.resolve(calendarItem)
      _.uniq(
        delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
      ).forEach(
        (delegateId) =>
          (promise = promise.then((contact) =>
            this.crypto.addDelegationsAndEncryptionKeys(patient, contact, dataOwnerId!, delegateId, dels.secretId, eks.secretId)
          ))
      )
      return promise
    })
  }

  findBy(hcpartyId: string, patient: models.Patient) {
    return this.crypto.extractDelegationsSFKs(patient, hcpartyId).then((secretForeignKeys) => {
      return secretForeignKeys && secretForeignKeys.extractedKeys && secretForeignKeys.extractedKeys.length > 0
        ? this.findByHCPartyPatientSecretFKeys(secretForeignKeys.hcpartyId!, _.uniq(secretForeignKeys.extractedKeys).join(','))
        : Promise.resolve([])
    })
  }

  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.CalendarItem> | any> {
    return super.findCalendarItemsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((calendarItems) => this.decrypt(hcPartyId, calendarItems))
  }

  createCalendarItem(body?: CalendarItem): never {
    throw new Error('Cannot call a method that must encrypt a calendar item without providing a user for de/encryption')
  }

  async createCalendarItemWithHcParty(user: models.User, body?: models.CalendarItem): Promise<models.CalendarItem | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((items) => super.createCalendarItem(items[0]))
          .then((ci) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [ci]))
          .then((cis) => cis[0])
      : null
  }

  getCalendarItemWithUser(user: models.User, calendarItemId: string): Promise<CalendarItem | any> {
    return super
      .getCalendarItem(calendarItemId)
      .then((calendarItem) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [calendarItem]))
      .then((cis) => cis[0])
  }

  getCalendarItem(calendarItemId: string): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsWithUser(user: models.User): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItems().then((calendarItems) => this.decrypt(this.userApi.getDataOwnerOf(user)!, calendarItems))
  }

  getCalendarItems(): never {
    throw new Error('Cannot call a method that must en/decrypt a calendar item without providing a user for de/encryption')
  }

  getCalendarItemsWithIdsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<CalendarItem> | any> {
    return super.getCalendarItemsWithIds(body).then((calendarItems) => this.decrypt(this.userApi.getDataOwnerOf(user)!, calendarItems))
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
      .then((calendarItems) => this.decrypt(this.userApi.getDataOwnerOf(user)!, calendarItems))
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
      .then((calendarItems) => this.decrypt(this.userApi.getDataOwnerOf(user)!, calendarItems))
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
          .then((ci) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [ci]))
          .then((cis) => cis[0])
      : null
  }

  initEncryptionKeys(user: models.User, calendarItem: models.CalendarItem): Promise<models.CalendarItem> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto.initEncryptionKeys(calendarItem, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(calendarItem, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((item) =>
            this.crypto.appendEncryptionKeys(item, dataOwnerId!, delegateId, eks.secretId).then((extraEks) => {
              return _.extend(item, {
                encryptionKeys: extraEks.encryptionKeys,
              })
            })
          ))
      )
      return promise
    })
  }

  encrypt(user: models.User, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    return Promise.all(
      calendarItems.map((calendarItem) =>
        (calendarItem.encryptionKeys && Object.keys(calendarItem.encryptionKeys).length
          ? Promise.resolve(calendarItem)
          : this.initEncryptionKeys(user, calendarItem)
        )
          .then((calendarItem: CalendarItem) =>
            this.crypto.extractKeysFromDelegationsForHcpHierarchy(this.userApi.getDataOwnerOf(user)!, calendarItem.id!, calendarItem.encryptionKeys!)
          )
          .then((eks: { extractedKeys: Array<string>; hcpartyId: string }) =>
            this.crypto.AES.importKey('raw', hex2ua(eks.extractedKeys[0].replace(/-/g, '')))
          )
          .then((key: CryptoKey) =>
            crypt(calendarItem, (obj: { [key: string]: string }) => this.crypto.AES.encrypt(key, utf8_2ua(JSON.stringify(obj))), this.encryptedKeys)
          )
      )
    )
  }

  decrypt(hcpId: string, calendarItems: Array<models.CalendarItem>): Promise<Array<models.CalendarItem>> {
    //First check that we have no dangling delegation

    return Promise.all(
      calendarItems.map((calendarItem) => {
        return calendarItem.encryptedSelf
          ? this.crypto
              .extractKeysFromDelegationsForHcpHierarchy(
                hcpId!,
                calendarItem.id!,
                _.size(calendarItem.encryptionKeys) ? calendarItem.encryptionKeys! : calendarItem.delegations!
              )
              .then(({ extractedKeys: sfks }) => {
                if (!sfks || !sfks.length) {
                  return Promise.resolve(calendarItem)
                }
                return this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, ''))).then((key) =>
                  decrypt(calendarItem, (ec) =>
                    this.crypto.AES.decrypt(key, ec)
                      .then((dec) => {
                        const jsonContent = dec && ua2utf8(dec)
                        try {
                          return JSON.parse(jsonContent)
                        } catch (e) {
                          console.log('Cannot parse calendar item', calendarItem.id, jsonContent || 'Invalid content')
                          return {}
                        }
                      })
                      .catch((err) => {
                        console.log('Error during AES decryption', err)
                        return {}
                      })
                  )
                )
              })
          : Promise.resolve(calendarItem)
      })
    )
  }
}
