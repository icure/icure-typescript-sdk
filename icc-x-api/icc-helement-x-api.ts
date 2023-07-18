import {IccAuthApi, IccHelementApi} from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { FilterChainHealthElement, HealthElement, PaginatedListHealthElement } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { EncryptedFieldsManifest, parseEncryptedFields } from './utils'
import {AbstractFilter} from "./filters/filters"
import {Connection, ConnectionImpl} from "../icc-api/model/Connection"
import {subscribeToEntityEvents} from "./utils/websocket"
import {IccUserXApi} from "./icc-user-x-api"

export class IccHelementXApi extends IccHelementApi implements EncryptedEntityXApi<models.HealthElement> {
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi
  private readonly userApi: IccUserXApi
  private readonly icureBasePath: string
  private readonly authApi: IccAuthApi
  private readonly encryptedFields: EncryptedFieldsManifest

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    userApi: IccUserXApi,
    icureBasePath: string,
    authApi: IccAuthApi,
    encryptedKeys: Array<string> = ['descr', 'note'],
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
    this.userApi = userApi
    this.icureBasePath = icureBasePath
    this.authApi = authApi
    this.encryptedFields = parseEncryptedFields(encryptedKeys, 'HealthElement.')
  }

  /**
   * Creates a new instance of health element with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this health element refers to.
   * @param h initialised data for the health element. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the classification. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * - confidential: if true, the entity will be created as confidential. Confidential entities are not shared with auto-delegations, and the default
   * foreign key used is any key that is not shared with any of the data owner parents. By default entities are created as non-confidential.
   * @return a new instance of health element.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
      preferredSfk?: string
      confidential?: boolean
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const helement = {
      ...(h ?? {}),
      _type: 'org.taktik.icure.entities.HealthElement',
      id: h?.id ?? this.crypto.primitives.randomUuid(),
      created: h?.created ?? new Date().getTime(),
      modified: h?.modified ?? new Date().getTime(),
      responsible: h?.responsible ?? dataOwnerId,
      author: h?.author ?? user.id,
      codes: h?.codes ?? [],
      tags: h?.tags ?? [],
      healthElementId: h?.healthElementId ?? this.crypto.primitives.randomUuid(),
      openingDate: h?.openingDate ?? parseInt(moment().format('YYYYMMDDHHmmss')),
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk =
      options.preferredSfk ??
      (!!options.confidential
        ? await this.crypto.confidential.getConfidentialSecretId(patient)
        : await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id} for confidential=${!!options.confidential}`)
    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(options.confidential ? [] : [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]),
    ]
    const initialisationInfo = await this.crypto.entities.entityWithInitialisedEncryptedMetadata(helement, patient.id, sfk, true, extraDelegations)
    return new models.HealthElement(initialisationInfo.updatedEntity)
  }

  createHealthElement(body?: models.HealthElement): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  createHealthElementWithUser(user: models.User, body?: models.HealthElement): Promise<models.HealthElement | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((hes) => super.createHealthElement(hes[0]))
          .then((he) => this.decryptWithUser(user, [he]))
          .then((hes) => hes[0])
      : Promise.resolve(null)
  }

  createHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  createHealthElementsWithUser(user: models.User, bodies?: models.HealthElement[]): Promise<models.HealthElement[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((hes) => super.createHealthElements(hes))
          .then((hes) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes))
      : Promise.resolve(null)
  }

  getHealthElement(healthElementId: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  getHealthElementWithUser(user: models.User, healthElementId: string): Promise<models.HealthElement> {
    return super
      .getHealthElement(healthElementId)
      .then((he) => this.decryptWithUser(user, [he]))
      .then((hes) => hes[0])
  }

  getHealthElements(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  getHealthElementsWithUser(user: models.User, body?: models.ListOfIds): Promise<models.HealthElement[]> {
    return super.getHealthElements(body).then((hes) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes))
  }

  newHealthElementDelegations(healthElementId: string, body?: Array<models.Delegation>): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  newHealthElementDelegationsWithUser(user: models.User, healthElementId: string, body?: Array<models.Delegation>): Promise<models.HealthElement> {
    return super
      .newHealthElementDelegations(healthElementId, body)
      .then((he) => this.decryptWithUser(user, [he]))
      .then((he) => he[0])
  }

  findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  findHealthElementsByHCPartyPatientForeignKeysWithUser(user: models.User, hcPartyId: string, secretFKeys: string): Promise<HealthElement[]> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((hes) => this.decryptWithUser(user, hes))
  }

  findHealthElementsByHCPartyPatientForeignKeysArrayWithUser(user: models.User, hcPartyId: string, secretFKeys: string[]): Promise<HealthElement[]> {
    return super.findHealthElementsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys).then((hes) => this.decryptWithUser(user, hes))
  }

  async findHealthElementsByHCPartyAndPatientWithUser(
    user: models.User,
    hcPartyId: string,
    patient: models.Patient,
    usingPost: boolean = false
  ): Promise<models.HealthElement[]> {
    let keysAndHcPartyId = await this.crypto.entities.secretIdsForHcpHierarchyOf(patient)
    const keys = keysAndHcPartyId.find((secretForeignKeys) => secretForeignKeys.ownerId == hcPartyId)?.extracted
    if (keys == undefined) {
      throw Error('No delegation for user')
    }
    return usingPost
      ? this.findHealthElementsByHCPartyPatientForeignKeysArrayWithUser(user, hcPartyId, keys)
      : this.findHealthElementsByHCPartyPatientForeignKeysWithUser(user, hcPartyId, keys.join(','))
  }

  modifyHealthElement(body?: HealthElement): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  modifyHealthElementWithUser(user: models.User, body?: HealthElement): Promise<HealthElement | any> {
    return body ? this.modifyAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }
  private modifyAs(dataOwner: string, body: HealthElement): Promise<HealthElement | any> {
    return this.encryptAs(dataOwner, [_.cloneDeep(body)])
      .then((hes) => super.modifyHealthElement(hes[0]))
      .then((he) => this.decrypt(dataOwner, [he]))
      .then((hes) => hes[0])
  }

  modifyHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  modifyHealthElementsWithUser(user: models.User, bodies?: HealthElement[]): Promise<HealthElement[] | any> {
    return bodies
      ? this.encrypt(
          user,
          bodies.map((c) => _.cloneDeep(c))
        )
          .then((hes) => super.modifyHealthElements(hes))
          .then((hes) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes))
      : Promise.resolve(null)
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all helements with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the helements of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   * @param keepObsoleteVersions
   * @param usingPost
   */

  findBy(hcpartyId: string, patient: models.Patient, keepObsoleteVersions = false, usingPost = false) {
    return this.crypto.entities
      .secretIdsForHcpHierarchyOf(patient)
      .then((secretForeignKeys) =>
        secretForeignKeys && secretForeignKeys.length > 0
          ? Promise.all(
              secretForeignKeys
                .reduce((acc, level) => {
                  return acc.concat([
                    {
                      hcpartyId: level.ownerId,
                      extractedKeys: level.extracted.filter((key) => !acc.some((previousLevel) => previousLevel.extractedKeys.includes(key))),
                    },
                  ])
                }, [] as Array<{ hcpartyId: string; extractedKeys: Array<string> }>)
                .filter((l) => l.extractedKeys.length > 0)
                .map(({ hcpartyId, extractedKeys }) =>
                  usingPost
                    ? this.findByHCPartyPatientSecretFKeysArray(hcpartyId, _.uniq(extractedKeys))
                    : this.findByHCPartyPatientSecretFKeys(hcpartyId, _.uniq(extractedKeys).join(','))
                )
            ).then((results) => _.uniqBy(_.flatMap(results), (x) => x.id))
          : Promise.resolve([])
      )
      .then((decryptedHelements: Array<models.HealthElement>) => {
        const byIds: { [key: string]: models.HealthElement } = {}

        if (keepObsoleteVersions) {
          return decryptedHelements
        } else {
          decryptedHelements.forEach((he) => {
            if (he.healthElementId) {
              const phe = byIds[he.healthElementId]
              if (!phe || !phe.modified || (he.modified && phe.modified < he.modified)) {
                byIds[he.healthElementId] = he
              }
            }
          })
          return _.values(byIds).filter((s: any) => !s.endOfLife)
        }
      })
  }

  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.Contact> | any> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((helements) => this.decrypt(hcPartyId, helements))
  }

  findByHCPartyPatientSecretFKeysArray(hcPartyId: string, secretFKeys: string[]): Promise<Array<models.Contact> | any> {
    return super
      .findHealthElementsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys)
      .then((helements) => this.decrypt(hcPartyId, helements))
  }

  encrypt(user: models.User, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), healthElements)
  }

  private encryptAs(owner: string, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return Promise.all(
      healthElements.map((he) =>
        this.crypto.entities.tryEncryptEntity(he, owner, this.encryptedFields, false, true, (x) => new models.HealthElement(x))
      )
    )
  }

  decryptWithUser(user: models.User, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes)
  }

  decrypt(dataOwnerId: string, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return Promise.all(
      hes.map((he) => this.crypto.entities.decryptEntity(he, dataOwnerId, (x) => new models.HealthElement(x)).then(({ entity }) => entity))
    )
  }

  filterHealthElementsBy(startDocumentId?: string, limit?: number, body?: FilterChainHealthElement): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  filterByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainHealthElement
  ): Promise<PaginatedListHealthElement> {
    return super
      .filterHealthElementsBy(startDocumentId, limit, body)
      .then((pl) => this.decryptWithUser(user, pl.rows!).then((dr) => Object.assign(pl, { rows: dr })))
  }

  // noinspection JSUnusedGlobalSymbols
  serviceToHealthElement(user: models.User, patient: models.Patient, heSvc: models.Service, descr: string) {
    return this.newInstance(user, patient, {
      idService: heSvc.id,
      author: heSvc.author,
      responsible: heSvc.responsible,
      openingDate: heSvc.valueDate || heSvc.openingDate,
      descr: descr,
      idOpeningContact: heSvc.contactId,
      modified: heSvc.modified,
      created: heSvc.created,
      codes: heSvc.codes,
      tags: heSvc.tags,
    }).then((he) => {
      return this.createHealthElement(he)
    })
  }

  // noinspection JSUnusedGlobalSymbols, JSMethodCanBeStatic
  stringToCode(code: string) {
    const c = code.split('|')
    return new models.Code({
      type: c[0],
      code: c[1],
      version: c[2],
      id: code,
    })
  }

  /**
   * @param healthElement a health element
   * @return the id of the patient that the health element refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(healthElement: models.HealthElement): Promise<string[]> {
    return this.crypto.entities.owningEntityIdsOf(healthElement, undefined)
  }

  /**
   * Share an existing health element with other data owners, allowing them to access the non-encrypted data of the health element and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the health element.
   * @param healthElement the health element to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * health element does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this health element refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated health element.
   */
  async shareWith(
    delegateId: string,
    healthElement: models.HealthElement,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.HealthElement> {
    return this.shareWithMany(healthElement, { [delegateId]: options })
  }
  /**
   * Share an existing health element with other data owners, allowing them to access the non-encrypted data of the health element and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param healthElement the health element to share.
   * @param delegates sharing options for each delegate.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * health element does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this health element refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated health element.
   */
  async shareWithMany(
    healthElement: models.HealthElement,
    delegates: {
      [delegateId: string]: {
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.HealthElement> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const extended = await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
      healthElement,
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
    } else return healthElement
  }

  async getDataOwnersWithAccessTo(
    entity: HealthElement
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: 'WRITE' }; hasUnknownAnonymousDataOwners: boolean }> {
    return await this.crypto.entities.getDataOwnersWithAccessTo(entity)
  }

  async getEncryptionKeysOf(entity: HealthElement): Promise<string[]> {
    return await this.crypto.entities.encryptionKeysOf(entity)
  }

  async subscribeToHealthElementEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<HealthElement> | undefined,
    eventFired: (dataSample: HealthElement) => Promise<void>,
    options: { connectionMaxRetry?: number; connectionRetryIntervalMs?: number } = {}
  ): Promise<Connection> {
    const currentUser = await this.userApi.getCurrentUser()

    return subscribeToEntityEvents(
      this.icureBasePath,
      this.authApi,
      'HealthElement',
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(currentUser), [encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }
}
