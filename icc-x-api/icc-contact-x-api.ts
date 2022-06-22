import { IccContactApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import i18n from './rsrc/contact.i18n'

import * as moment from 'moment'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { Contact, FilterChainService, ListOfIds, Service } from '../icc-api/model/models'
import { PaginatedListContact } from '../icc-api/model/PaginatedListContact'
import { a2b, b2a, hex2ua, string2ua, ua2string, ua2utf8, utf8_2ua } from './utils/binary-utils'
import { ServiceByIdsFilter } from './filters/ServiceByIdsFilter'
import { IccUserXApi } from './icc-user-x-api'
import { truncateTrailingNulls, before } from './utils'

export class IccContactXApi extends IccContactApi {
  i18n: any = i18n
  crypto: IccCryptoXApi
  userApi: IccUserXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    userApi: IccUserXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.userApi = userApi
  }

  newInstance(user: models.User, patient: models.Patient, c: any, confidential = false, delegates: string[] = []): Promise<models.Contact> {
    const contact = new models.Contact(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.Contact',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: this.userApi.getDataOwnerOf(user),
          author: user.id,
          codes: [],
          tags: [],
          groupId: this.crypto.randomUuid(),
          subContacts: [],
          services: [],
          openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
        },
        c || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, contact, confidential, delegates)
  }

  /**
   * 1. Extract(decrypt) the patient's secretForeignKeys from the
   * "delegations" object.
   * 2. Initialize & encrypt the Contact's delegations & cryptedForeignKeys.
   * 3. Initialize & encrypt the Contact's encryptionKeys.
   * 4. Return the contact with the extended delegations, cryptedForeignKeys
   * & encryptionKeys.
   */
  private initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient,
    contact: models.Contact,
    confidential = false,
    delegates: string[] = []
  ): Promise<models.Contact> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto.extractPreferredSfk(patient, dataOwnerId!, confidential).then(async (key) => {
      if (!key) {
        console.error(`SFK cannot be found for Contact ${key}. The contact will not be reachable from the patient side`)
      }
      const dels = await this.crypto.initObjectDelegations(contact, patient, dataOwnerId!, key ?? null)
      const eks = await this.crypto.initEncryptionKeys(contact, dataOwnerId!)
      _.extend(contact, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys,
      })

      let promise = Promise.resolve(contact)
      _.uniq(
        delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
      ).forEach(
        (delegateId) =>
          (promise = promise.then((contact) =>
            this.crypto.addDelegationsAndEncryptionKeys(patient, contact, dataOwnerId!, delegateId, dels.secretId, eks.secretId).catch((e) => {
              console.log(e)
              return contact
            })
          ))
      )
      ;(user.autoDelegations && user.autoDelegations.anonymousMedicalInformation ? user.autoDelegations.anonymousMedicalInformation : []).forEach(
        (delegateId) =>
          (promise = promise.then((contact) =>
            this.crypto.addDelegationsAndEncryptionKeys(patient, contact, dataOwnerId!, delegateId, null, eks.secretId).catch((e) => {
              console.log(e)
              return contact
            })
          ))
      )
      return promise
    })
  }

  initEncryptionKeys(user: models.User, ctc: models.Contact) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)

    return this.crypto.initEncryptionKeys(ctc, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(ctc, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations
        ? (user.autoDelegations.all || [])
            .concat(user.autoDelegations.medicalInformation || [])
            .concat(user.autoDelegations.anonymousMedicalInformation || [])
        : []
      ).forEach(
        (delegateId) =>
          (promise = promise.then((contact) =>
            this.crypto
              .appendEncryptionKeys(contact, dataOwnerId!, delegateId, eks.secretId)
              .then((extraEks) => {
                return _.extend(contact, {
                  encryptionKeys: extraEks.encryptionKeys,
                })
              })
              .catch((e) => {
                console.log(e.message)
                return contact
              })
          ))
      )
      return promise
    })
  }

  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.Patient) {
    return this.crypto.extractSFKsHierarchyFromDelegations(patient, hcpartyId).then((secretForeignKeys) =>
      secretForeignKeys && secretForeignKeys.length > 0
        ? Promise.all(
            secretForeignKeys
              .reduce((acc, level) => {
                return acc.concat([
                  {
                    hcpartyId: level.hcpartyId,
                    extractedKeys: level.extractedKeys.filter((key) => !acc.some((previousLevel) => previousLevel.extractedKeys.includes(key))),
                  },
                ])
              }, [] as Array<{ hcpartyId: string; extractedKeys: Array<string> }>)
              .filter((l) => l.extractedKeys.length > 0)
              .map(({ hcpartyId, extractedKeys }) => this.findByHCPartyPatientSecretFKeys(hcpartyId, _.uniq(extractedKeys).join(',')))
          ).then((results) => _.uniqBy(_.flatMap(results), (x) => x.id))
        : Promise.resolve([])
    )
  }

  async findByPatientSFKs(hcpartyId: string, patients: Array<models.Patient>): Promise<Array<models.Contact>> {
    const perHcpId: { [key: string]: string[] } = {}
    for (const patient of patients) {
      ;(await this.crypto.extractSFKsHierarchyFromDelegations(patient, hcpartyId))
        .reduce((acc, level) => {
          return acc.concat([
            {
              hcpartyId: level.hcpartyId,
              extractedKeys: level.extractedKeys.filter((key) => !acc.some((previousLevel) => previousLevel.extractedKeys.includes(key))),
            },
          ])
        }, [] as Array<{ hcpartyId: string; extractedKeys: Array<string> }>)
        .filter((l) => l.extractedKeys.length > 0)
        .forEach(({ hcpartyId, extractedKeys }) => {
          ;(perHcpId[hcpartyId] || (perHcpId[hcpartyId] = [])).push(...extractedKeys)
        })
    }

    return _.uniqBy(
      _.flatMap(
        await Promise.all(
          Object.keys(perHcpId).map((hcpId) =>
            this.findContactsByHCPartyPatientForeignKeys(
              hcpartyId,
              new models.ListOfIds({
                ids: perHcpId[hcpId],
              })
            )
          )
        )
      ),
      (x) => x.id
    )
  }

  filterBy(startKey?: string, startDocumentId?: string, limit?: number, body?: models.FilterChainContact): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listContactsByOpeningDate(startKey: number, endKey: number, hcpartyid: string, startDocumentId?: string, limit?: number): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  listServices(body?: ListOfIds): Promise<Array<Service>> {
    throw new Error('Cannot call a method that returns services without providing a user for de/encryption')
  }

  findByHCPartyFormId(hcPartyId?: string, formId?: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  findByHCPartyFormIds(hcPartyId?: string, body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  getContact(contactId: string): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  getContacts(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns contacts without providing a user for de/encryption')
  }

  modifyContact(body?: Contact): never {
    throw new Error('Cannot call a method that modify contacts without providing a user for de/encryption')
  }

  modifyContacts(body?: Array<Contact>): never {
    throw new Error('Cannot call a method that modify contacts without providing a user for de/encryption')
  }

  createContact(body?: Contact): never {
    throw new Error('Cannot call a method that modify contacts without providing a user for de/encryption')
  }

  findByHCPartyPatientSecretFKeys(
    hcPartyId: string,
    secretFKeys: string,
    planOfActionIds?: string,
    skipClosedContacts?: boolean
  ): Promise<Array<models.Contact> | any> {
    return super
      .findByHCPartyPatientSecretFKeys(hcPartyId, secretFKeys, planOfActionIds, skipClosedContacts)
      .then((contacts) => this.decrypt(hcPartyId, contacts))
  }

  filterByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: models.FilterChainContact
  ): Promise<PaginatedListContact | any> {
    return super
      .filterContactsBy(startDocumentId, limit, body)
      .then((ctcs) =>
        this.decrypt(user.healthcarePartyId! || user.patientId!, ctcs.rows!).then((decryptedRows) => Object.assign(ctcs, { rows: decryptedRows }))
      )
  }

  listContactsByOpeningDateWithUser(
    user: models.User,
    startKey: number,
    endKey: number,
    hcpartyid: string,
    startDocumentId?: string,
    limit?: number
  ): Promise<PaginatedListContact | any> {
    return super
      .listContactsByOpeningDate(startKey, endKey, hcpartyid, startDocumentId, limit)
      .then((ctcs) =>
        this.decrypt(user.healthcarePartyId! || user.patientId!, ctcs.rows!).then((decryptedRows) => Object.assign(ctcs, { rows: decryptedRows }))
      )
  }

  listServicesWithUser(user: models.User, serviceIds: ListOfIds): Promise<Array<Service> | any> {
    return super
      .filterServicesBy(undefined, serviceIds.ids?.length, new FilterChainService({ filter: new ServiceByIdsFilter({ ids: serviceIds.ids }) }))
      .then((paginatedList) => this.decryptServices(user.healthcarePartyId! || user.patientId!, paginatedList.rows ?? [], undefined, undefined))
  }

  findByHCPartyFormIdWithUser(user: models.User, hcPartyId: string, formId: string): Promise<Array<models.Contact> | any> {
    return super.findByHCPartyFormId(hcPartyId, formId).then((ctcs) => this.decrypt(this.userApi.getDataOwnerOf(user)!, ctcs))
  }

  findByHCPartyFormIdsWithUser(user: models.User, hcPartyId: string, body: models.ListOfIds): Promise<Array<models.Contact> | any> {
    return super.findByHCPartyFormIds(hcPartyId, body).then((ctcs) => this.decrypt(this.userApi.getDataOwnerOf(user)!, ctcs))
  }

  getContactWithUser(user: models.User, contactId: string): Promise<models.Contact | any> {
    return super
      .getContact(contactId)
      .then((ctc) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [ctc]))
      .then((ctcs) => ctcs[0])
  }

  getContactsWithUser(user: models.User, body?: models.ListOfIds): Promise<Array<models.Contact> | any> {
    return super.getContacts(body).then((ctcs) => this.decrypt(this.userApi.getDataOwnerOf(user)!, ctcs))
  }

  async modifyContactWithUser(user: models.User, body?: models.Contact): Promise<models.Contact | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((ctcs) => super.modifyContact(ctcs[0]))
          .then((ctc) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [ctc]))
          .then((ctcs) => ctcs[0])
      : null
  }

  async modifyContactsWithUser(user: models.User, bodies?: Array<models.Contact>): Promise<models.Contact[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((ctcs) => super.modifyContacts(ctcs))
          .then((ctcs) => this.decrypt(this.userApi.getDataOwnerOf(user)!, ctcs))
      : null
  }

  async createContactWithUser(user: models.User, body?: models.Contact): Promise<models.Contact | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((ctcs) => super.createContact(ctcs[0]))
          .then((ctc) => this.decrypt(this.userApi.getDataOwnerOf(user)!, [ctc]))
          .then((ctcs) => ctcs[0])
      : null
  }

  async createContactsWithUser(user: models.User, bodies?: Array<models.Contact>): Promise<models.Contact[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((ctcs) => super.createContacts(ctcs))
          .then((ctcs) => this.decrypt(this.userApi.getDataOwnerOf(user)!, ctcs))
      : null
  }

  encryptServices(key: CryptoKey, rawKey: string, services: Service[]): PromiseLike<Service[]> {
    return Promise.all(
      services.map(async (svc) => {
        if (!svc.content) {
          return svc
        }

        if (
          Object.values(svc.content).every(
            (c) =>
              c.compoundValue &&
              !c.stringValue &&
              !c.documentId &&
              !c.measureValue &&
              !c.medicationValue &&
              (c.booleanValue === null || c.booleanValue === undefined) &&
              (c.numberValue === null || c.numberValue === undefined) &&
              !c.instantValue &&
              !c.fuzzyDateValue &&
              !c.binaryValue
          )
        ) {
          svc.content = _.fromPairs(
            await Promise.all(
              _.toPairs(svc.content).map(async (p) => {
                if (p[1].compoundValue?.length) {
                  p[1].compoundValue = await this.encryptServices(key, rawKey, p[1].compoundValue!)
                }
                return p
              })
            )
          )
        } else {
          svc.encryptedSelf = b2a(ua2string(await this.crypto.AES.encrypt(key, utf8_2ua(JSON.stringify({ content: svc.content })), rawKey)))
          delete svc.content
        }
        return svc
      })
    )
  }

  encrypt(user: models.User, ctcs: Array<models.Contact>) {
    const hcpartyId = this.userApi.getDataOwnerOf(user)!
    const bypassEncryption = false //Used for debug

    return Promise.all(
      ctcs.map(async (ctc) => {
        const initialisedCtc = bypassEncryption //Prevent encryption for test ctc
          ? ctc
          : await (ctc.encryptionKeys && Object.keys(ctc.encryptionKeys || {}).length ? Promise.resolve(ctc) : this.initEncryptionKeys(user, ctc))

        const sfks: {
          extractedKeys: Array<string>
          hcpartyId: string
        } = await this.crypto.extractKeysFromDelegationsForHcpHierarchy(hcpartyId, initialisedCtc.id!, initialisedCtc.encryptionKeys!)
        const rawKey = sfks.extractedKeys[0].replace(/-/g, '')
        const key = await this.crypto.AES.importKey('raw', hex2ua(rawKey))

        initialisedCtc.services = await this.encryptServices(key, rawKey, ctc.services || [])
        initialisedCtc.encryptedSelf = b2a(ua2string(await this.crypto.AES.encrypt(key, utf8_2ua(JSON.stringify({ descr: ctc.descr })), rawKey)))
        delete initialisedCtc.descr

        return initialisedCtc
      })
    )
  }

  decrypt(hcpartyId: string, ctcs: Array<models.Contact>): Promise<Array<models.Contact>> {
    return Promise.all(
      ctcs.map(async (ctc) => {
        const { extractedKeys: sfks } = await this.crypto.extractKeysFromDelegationsForHcpHierarchy(
          hcpartyId,
          ctc.id!,
          _.size(ctc.encryptionKeys) ? ctc.encryptionKeys! : ctc.delegations!
        )
        if (!sfks || !sfks.length) {
          console.log('Cannot decrypt contact', ctc.id)
          return ctc
        }
        const rawKey = sfks[0].replace(/-/g, '')
        const key = await this.crypto.AES.importKey('raw', hex2ua(rawKey))

        ctc.services = await this.decryptServices(hcpartyId, ctc.services || [], key, rawKey)
        if (ctc.encryptedSelf) {
          try {
            const dec = await this.crypto.AES.decrypt(key, string2ua(a2b(ctc.encryptedSelf!)), rawKey)
            let jsonContent
            try {
              jsonContent = dec && ua2utf8(dec)
              jsonContent && _.assign(ctc, JSON.parse(jsonContent))
            } catch (e) {
              console.log('Cannot parse ctc', ctc.id, jsonContent || '<- Invalid encoding')
            }
          } catch {
            console.log('Cannot decrypt contact', ctc.id)
          }
        }
        return ctc
      })
    )
  }

  decryptServices(hcpartyId: string, svcs: Array<models.Service>, key?: CryptoKey, rawKey?: string): Promise<Array<models.Service>> {
    return Promise.all(
      svcs.map(async (svc) => {
        if (!key) {
          const { extractedKeys: sfks } = await this.crypto.extractKeysFromDelegationsForHcpHierarchy(
            hcpartyId,
            svc.id!,
            _.size(svc.encryptionKeys) ? svc.encryptionKeys! : svc.delegations!
          )
          key = await this.crypto.AES.importKey('raw', hex2ua(sfks[0].replace(/-/g, '')))
        }

        if (svc.encryptedContent) {
          try {
            const dec = await this.crypto.AES.decrypt(key, string2ua(a2b(svc.encryptedContent!)))
            let jsonContent
            try {
              jsonContent = ua2utf8(truncateTrailingNulls(new Uint8Array(dec)))
              Object.assign(svc, { content: JSON.parse(jsonContent) })
            } catch (e) {
              console.log('Cannot parse service', svc.id, jsonContent || '<- Invalid encoding')
            }
          } catch {
            console.log('Cannot decrypt service', svc.id)
          }
        } else if (svc.encryptedSelf) {
          try {
            const dec = await this.crypto.AES.decrypt(key, string2ua(a2b(svc.encryptedSelf!)))
            let jsonContent
            try {
              jsonContent = ua2utf8(truncateTrailingNulls(new Uint8Array(dec)))
              Object.assign(svc, JSON.parse(jsonContent))
            } catch (e) {
              console.log('Cannot parse service', svc.id, jsonContent || '<- Invalid encoding')
            }
          } catch {
            console.log('Cannot decrypt service', svc.id)
          }
        } else {
          svc.content = _.fromPairs(
            await Promise.all(
              _.toPairs(svc.content).map(async (p) => {
                if (p[1].compoundValue) {
                  p[1].compoundValue = await this.decryptServices(hcpartyId, p[1].compoundValue, key, rawKey)
                }
                return p
              })
            )
          )
        }
        return svc
      })
    )
  }

  contactOfService(ctcs: Array<models.Contact>, svcId: string): models.Contact | undefined {
    let latestContact: models.Contact | undefined = undefined
    let latestService: models.Service
    ctcs.forEach((c) => {
      const s: models.Service | undefined = c.services!.find((it) => svcId === it.id)
      if (s && (!latestService || moment(s.valueDate).isAfter(moment(latestService.valueDate)))) {
        latestContact = c
        latestService = s
      }
    })
    return latestContact
  }

  filteredServices(ctcs: Array<models.Contact>, filter: any): Array<models.Service> {
    const byIds: { [key: string]: models.Service } = {}
    ctcs.forEach((c) =>
      (c.services || [])
        .filter((s) => filter(s, c))
        .forEach((s) => {
          const ps = byIds[s.id!]
          if (!ps || !ps.modified || (s.modified && ps.modified < s.modified)) {
            byIds[s.id!] = s
            s.contactId = c.id
          }
        })
    )
    return _.values(byIds).filter((s: any) => !s.deleted && !s.endOfLife)
  }

  //Return a promise
  filterServices(ctcs: Array<models.Contact>, filter: any): Promise<Array<models.Service>> {
    return Promise.resolve(this.filteredServices(ctcs, filter))
  }

  services(ctc: models.Contact, label: string) {
    return ctc.services!.filter((s) => s.label === label)
  }

  preferredContent(svc: models.Service, lng: string) {
    return (
      svc && svc.content && (svc.content[lng] || svc.content['fr'] || (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null))
    )
  }

  contentValue(c: models.Content) {
    return (
      c.stringValue ||
      ((c.numberValue || c.numberValue === 0) && c.numberValue) ||
      (c.measureValue && (c.measureValue.value || c.measureValue.value === 0) ? c.measureValue : null) ||
      c.medicationValue ||
      c.booleanValue
    )
  }

  shortServiceDescription(svc: models.Service, lng: string) {
    const c = this.preferredContent(svc, lng)
    return !c ? '' : this.shortContentDescription(c, lng, svc.label)
  }

  shortContentDescription(c: models.Content, lng: string, label?: string) {
    return (
      c.stringValue ||
      ((c.numberValue || c.numberValue === 0) && c.numberValue) ||
      (c.measureValue &&
        '' +
          (c.measureValue.value || c.measureValue.value === 0 ? c.measureValue.value : '-') +
          (c.measureValue.unit ? ' ' + c.measureValue.unit : '')) ||
      (c.medicationValue ? this.medication().medicationToString(c.medicationValue, lng) : null) ||
      (c.booleanValue && label) ||
      'OK'
    )
  }

  medicationValue(svc: models.Service, lng: string) {
    const c =
      svc && svc.content && (svc.content[lng] || svc.content['fr'] || (Object.keys(svc.content)[0] ? svc.content[Object.keys(svc.content)[0]] : null))
    return c && c.medicationValue
  }

  contentHasData(c: any): boolean {
    return c.stringValue || c.numberValue || c.measureValue || c.booleanValue || c.booleanValue === false || c.medicationValue || c.documentId
  }

  localize(e: any, lng: string) {
    if (!e) {
      return null
    }
    return e[lng] || e.fr || e.en || e.nl
  }

  /**
   * Modifies the subcontacts this svc belongs to while minimizing the number of references to the svcs inside the subcontacts
   * After the invocation, there is at least one subcontact with provided poaId and heId that contains the svc
   * The svc is not removed from a previous subcontact it would belong to except if the new conditions are compatible
   * Note that undefined and null do not have the same meaning for formId
   * If formId is null: the subcontact which refers svc must have a null formId
   * If formId is undefined, the subcontact can have any value for formId
   *
   * When a svc does not exist yet in the current contact but exists in a previous contact, all the scs it was belonging to are
   * copied in the current contact
   *
   * the svc returned is the one that's inside the ctc
   *
   * @param ctc
   * @param user
   * @param ctcs
   * @param svc
   * @param formId
   * @param poaId aMap {heId2: [poaId11, poaId12], heId2: [poaId21] }
   * @param heId an Array of heIds, equivalent to poaIds = {heId: [], ...}
   * @param init
   * @returns {*}
   */

  promoteServiceInContact(
    ctc: models.Contact,
    user: models.User,
    ctcs: Array<models.Contact>,
    svc: models.Service,
    formId: string,
    poaIds?: { [key: string]: string[] },
    heIds?: Array<string>,
    init?: any
  ) {
    if (!ctc) {
      return null
    }
    const existing = ctc.services!.find((s) => s.id === svc.id)
    const promoted = _.extend(_.extend(existing || {}, svc), {
      author: user.id,
      responsible: this.userApi.getDataOwnerOf(user),
      modified: new Date().getTime(),
    })
    if (!existing) {
      ;(ctc.services || (ctc.services = [])).push(promoted)
    }
    const allSubcontactsInCurrentContactContainingService = (ctc.subContacts || []).filter((csc) =>
      (csc.services || []).some((s) => s.serviceId === svc.id)
    )

    //Rearrange poaIds and heIds as a hierarchy
    const hierarchyOfHeAndPoaIds: { [key: string]: Array<any> } = {}
    ;(heIds || []).forEach((id) => (hierarchyOfHeAndPoaIds[id || '_'] = []))
    Object.keys(poaIds || {}).forEach((k: string) => {
      const poas = hierarchyOfHeAndPoaIds[k]
      if (poas) {
        hierarchyOfHeAndPoaIds[k] = _.concat(poas, (poaIds || {})[k])
      } else {
        hierarchyOfHeAndPoaIds[k] = (poaIds || {})[k]
      }
    })

    const pastCtc =
      (svc.contactId && svc.contactId !== ctc.id && ctcs.find((c) => c.id === svc.contactId)) ||
      ctcs.reduce(
        (selected: { s: models.Service | null; c: models.Contact | null }, c: models.Contact) => {
          const candidate = (c.services || []).find((s) => s.id === svc.id)
          return ctc.id !== c.id && candidate && (selected.s === null || before(selected.s.modified || 0, candidate.modified || 0))
            ? { s: candidate, c: c }
            : selected
        },
        { s: null, c: null }
      ).c
    //Make sure that all scs the svc was belonging to are copied inside the current contact
    pastCtc &&
      pastCtc
        .subContacts!.filter((psc) => psc.services!.some((s) => s.serviceId === svc.id))
        .forEach((psc) => {
          const sameInCurrent = allSubcontactsInCurrentContactContainingService.find(
            (csc) => csc.formId === psc.formId && csc.planOfActionId === psc.planOfActionId && csc.healthElementId === psc.healthElementId
          )
          if (sameInCurrent) {
            if (!sameInCurrent.services!.some((s) => s.serviceId === svc.id)) {
              sameInCurrent.services!.push({ serviceId: svc.id })
            }
          } else {
            const newSubContact = _.assign(_.assign({}, psc), {
              services: [{ serviceId: svc.id }],
            })
            ctc.subContacts!.push(newSubContact)
            allSubcontactsInCurrentContactContainingService.push(newSubContact)
          }
        })

    if (!Object.keys(hierarchyOfHeAndPoaIds).length) {
      hierarchyOfHeAndPoaIds._ = [] //Default is to have at least one option with heId equals to null (represented by _)
    }

    Object.keys(hierarchyOfHeAndPoaIds).forEach((heId: string | null) => {
      if (heId === '_') {
        heId = null
      }
      const subPoaIds = heId ? hierarchyOfHeAndPoaIds[heId] : []
      ;((subPoaIds || []).length ? subPoaIds : [null]).forEach((poaId) => {
        //Create or assign subcontacts for all pairs he/poa (can be null/null)
        let destinationSubcontact = ctc.subContacts!.find(
          (sc) =>
            (!formId || sc.formId === formId) &&
            ((!poaId && !sc.planOfActionId) || sc.planOfActionId === poaId) &&
            ((!heId && !sc.healthElementId) || sc.healthElementId === heId)
        )
        if (!destinationSubcontact) {
          ctc.subContacts!.push(
            (destinationSubcontact = new models.SubContact({
              formId: formId || undefined,
              planOfActionId: poaId,
              healthElementId: heId,
              services: [],
            }))
          )
        }

        const redundantSubcontact =
          allSubcontactsInCurrentContactContainingService.find((aSc) => destinationSubcontact === aSc) ||
          allSubcontactsInCurrentContactContainingService.find(
            (aSc) =>
              (!aSc.planOfActionId || aSc.planOfActionId === destinationSubcontact!.planOfActionId) &&
              (!aSc.healthElementId || aSc.healthElementId === destinationSubcontact!.healthElementId) &&
              (!aSc.formId || aSc.formId === destinationSubcontact!.formId)
          ) // Find a compatible sc: one that does not contain extra and ≠ information than the destination

        if (redundantSubcontact && redundantSubcontact !== destinationSubcontact) {
          redundantSubcontact.services!.splice(
            redundantSubcontact.services!.findIndex((link) => link.serviceId === svc.id),
            1
          )
        }
        if (!destinationSubcontact.services!.some((s) => s.serviceId === svc.id)) {
          destinationSubcontact.services!.push({ serviceId: svc.id! })
        }
      })
    })

    return (init && init(promoted)) || promoted
  }

  isNumeric(svc: models.Service, lng: string) {
    const c = this.preferredContent(svc, lng)
    return c && (c.measureValue || c.numberValue || c.numberValue == 0)
  }

  service() {
    return {
      newInstance: (user: models.User, s: any) =>
        _.extend(
          {
            id: this.crypto.randomUuid(),
            _type: 'org.taktik.icure.entities.embed.Service',
            created: new Date().getTime(),
            modified: new Date().getTime(),
            responsible: this.userApi.getDataOwnerOf(user),
            author: user.id,
            codes: [],
            tags: [],
            content: {},
            valueDate: parseInt(moment().format('YYYYMMDDHHmmss')),
          },
          s
        ),
    }
  }

  medication() {
    const regimenScores: any = {
      afterwakingup: 63000,
      beforebreakfast: 70000,
      duringbreakfast: 80000,
      afterbreakfast: 90000,
      morning: 100000,
      betweenbreakfastandlunch: 103000,
      beforelunch: 113000,
      midday: 120000,
      duringlunch: 123000,
      afterlunch: 130000,
      afternoon: 140000,
      betweenlunchanddinner: 160000,
      beforedinner: 180000,
      duringdinner: 190000,
      afterdinner: 200000,
      evening: 210000,
      betweendinnerandsleep: 213000,
      thehourofsleep: 220000,
      night: 230000,
      beforemeals: -30000,
      betweenmeals: -20000,
      aftermeals: -10000,
    }

    const myself = {
      regimenScores: function () {
        return regimenScores
      },
      medicationNameToString: function (m: any): string {
        return m && m.compoundPrescription
          ? m.compoundPrescription
          : m && m.substanceProduct
          ? myself.productToString(m && m.substanceProduct)
          : myself.productToString(m && m.medicinalProduct)
      },
      reimbursementReasonToString: (m: any, lang: string) => {
        return m && m.reimbursementReason && m.reimbursementReason.label && m.reimbursementReason.label.hasOwnProperty(lang)
          ? m.reimbursementReason.label[lang]
          : ''
      },
      medicationToString: (m: any, lang: string) => {
        let res = `${myself.medicationNameToString(m)}, ${myself.posologyToString(m, lang)}`
        const reason = myself.reimbursementReasonToString(m, lang)
        res = m.numberOfPackages
          ? `${m.numberOfPackages} ${m.numberOfPackages > 1 ? this.i18n[lang].packagesOf : this.i18n[lang].packageOf} ${res}`
          : res
        res = m.duration ? `${res} ${this.i18n[lang].during} ${myself.durationToString(m.duration, lang)}` : res
        res = reason ? `${res} (${reason})` : res
        return res
      },
      productToString: (m: any): string => {
        if (!m) {
          return ''
        }
        return m.intendedname
      },
      posologyToString: (m: any, lang: string) => {
        if (m) {
          if (m.instructionForPatient && m.instructionForPatient.length) {
            return m.instructionForPatient
          }
          if (!m.regimen || !m.regimen.length) {
            return ''
          }

          const unit =
            m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.administrationUnit
              ? m.regimen[0].administratedQuantity.administrationUnit.code
              : m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.unit
          let quantity = m.regimen[0].administratedQuantity && m.regimen[0].administratedQuantity.quantity

          m.regimen.slice(1).find((ri: any) => {
            const oUnit =
              ri.administratedQuantity && ri.administratedQuantity.administrationUnit
                ? ri.administratedQuantity.administrationUnit.code
                : ri.administratedQuantity && ri.administratedQuantity.unit
            const oQuantity = ri.administratedQuantity && ri.administratedQuantity.quantity

            if (oQuantity !== quantity) {
              quantity = -1
            }
            return oUnit !== unit && oQuantity !== quantity
          })

          const cplxRegimen = !unit || quantity < 0
          const quantityUnit = cplxRegimen ? `1 ${this.i18n[lang].take_s_}` : `${quantity} ${unit || this.i18n[lang].take_s_}`

          const dayPeriod = m.regimen.find((r: any) => r.weekday !== null && r.weekday !== undefined)
            ? this.i18n[lang].weekly
            : m.regimen.find((r: any) => r.date)
            ? this.i18n[lang].monthly
            : this.i18n[lang].daily

          return `${quantityUnit}, ${m.regimen.length} x ${dayPeriod}, ${_.sortBy(
            m.regimen,
            (r) =>
              (r.date ? r.date * 1000000 : 29990000000000) +
              (r.dayNumber || 0) * 1000000 +
              ((r.weekday && r.weekday.weekNumber) || 0) * 7 * 1000000 +
              (r.timeOfDay ? r.timeOfDay : r.dayPeriod && r.dayPeriod.code ? (regimenScores[r.dayPeriod.code] as number) : 0)
          )
            .map((r) => (cplxRegimen ? myself.regimenToExtString(r, lang) : myself.regimenToString(r, lang)))
            .join(', ')}`
        }
      },
      frequencyToString: (m: any, lang: string) => {
        if (m.instructionForPatient && m.instructionForPatient.length) {
          return m.instructionForPatient
        }
        if (!m.regimen || !m.regimen.length) {
          return ''
        }

        const dayPeriod = m.regimen.find((r: any) => r.weekday !== null && r.weekday !== undefined)
          ? this.i18n[lang].weekly
          : m.regimen.find((r: any) => r.date)
          ? this.i18n[lang].monthly
          : this.i18n[lang].daily

        return `${m.regimen.length} x ${dayPeriod}`
      },
      durationToString: (d: models.Duration, lang: string) => {
        return d.value ? `${d.value} ${this.localize(d.unit!.label, lang)}` : ''
      },
      regimenToExtString: (r: models.RegimenItem, lang: string) => {
        const desc = myself.regimenToString(r, lang)
        return (
          (r.administratedQuantity && r.administratedQuantity.quantity && desc
            ? `${desc} (${r.administratedQuantity.quantity} ${
                (r.administratedQuantity.administrationUnit ? r.administratedQuantity.administrationUnit.code : r.administratedQuantity.unit) ||
                this.i18n[lang].take_s_
              })`
            : desc) || ''
        )
      },
      regimenToString: (r: models.RegimenItem, lang: string) => {
        let res = r.date
          ? `${this.i18n[lang].the} ${moment(r.date).format('DD/MM/YYYY')}`
          : r.dayNumber
          ? `${this.i18n[lang].onDay} ${r.dayNumber}`
          : r.weekday && r.weekday.weekday
          ? `${this.i18n[lang].on} ${r.weekday.weekday}`
          : null
        if (r.dayPeriod && r.dayPeriod.code && r.dayPeriod.code.length) {
          res = res
            ? `${res} ${this.i18n[lang][r.dayPeriod.code] || this.localize(r.dayPeriod.label, lang) || r.dayPeriod.code}`
            : this.i18n[lang][r.dayPeriod.code] || this.localize(r.dayPeriod.label, lang) || r.dayPeriod.code
        }
        if (r.timeOfDay) {
          const timeOfDay =
            r.timeOfDay === 120000
              ? this.i18n[lang].noon
              : `${Math.floor(r.timeOfDay / 10000)}:${('' + (Math.floor(r.timeOfDay / 100) % 100)).replace(/^(.)$/, '0$1')}`
          res = res ? res + ' ' + this.i18n[lang].at + ' ' + timeOfDay : timeOfDay
        }
        return res
      },
      localize: (s: any, lang: string) => {
        if (!s) {
          return s
        }
        return (
          this.i18n[lang][s] ||
          (this.i18n[lang][s.toLowerCase()] &&
            this.i18n[lang][s.toLowerCase()]
              .split('')
              .map((c: string, idx: number) => (idx >= s.length || s[idx].toLocaleLowerCase() === s[idx] ? c : c.toLocaleUpperCase()))
              .join('')) ||
          s
        ) //Applies the (lower/upper)case to the translated lowercase version of the input string (s)
      },
    }
    return myself
  }
}
