import { IccAuthApi, IccHelementApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { FilterChainHealthElement, HealthElement, PaginatedListHealthElement, TimingInfo } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { IccUserXApi } from './icc-user-x-api'
import { EncryptedFieldsManifest, EntityWithDelegationTypeName, parseEncryptedFields, subscribeToEntityEvents, SubscriptionOptions } from './utils'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { AbstractFilter } from './filters/filters'
import { Connection, ConnectionImpl } from '../icc-api/model/Connection'
import { SecretIdUseOption } from './crypto/SecretIdUseOption'

export class IccHelementXApi extends IccHelementApi implements EncryptedEntityXApi<models.HealthElement> {
  private readonly encryptedFields: EncryptedFieldsManifest

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.HealthElement))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly userApi: IccUserXApi,
    private readonly authApi: IccAuthApi,
    private readonly autofillAuthor: boolean,
    encryptedKeys: Array<string> = ['descr', 'note'],
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
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
   * auto-delegations, in such case the access level specified here will be used.
   * - sfkOption: specifies which sfk of the owning entity to use.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of health element.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      sfkOption?: SecretIdUseOption
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
    } = {}
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const helement = {
      ...(h ?? {}),
      _type: 'org.taktik.icure.entities.HealthElement',
      id: h?.id ?? this.crypto.primitives.randomUuid(),
      created: h?.created ?? new Date().getTime(),
      modified: h?.modified ?? new Date().getTime(),
      responsible: h?.responsible ?? (this.autofillAuthor ? dataOwnerId : undefined),
      author: h?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: h?.codes ?? [],
      tags: h?.tags ?? [],
      healthElementId: h?.healthElementId ?? this.crypto.primitives.randomUuid(),
      openingDate: h?.openingDate ?? parseInt(moment().format('YYYYMMDDHHmmss')),
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = await this.crypto.xapi.resolveSecretIdUseOptions(
      { entity: patient, type: EntityWithDelegationTypeName.Patient },
      options.sfkOption ?? SecretIdUseOption.UseAnySharedWithParent
    )
    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
          )),
      ...(options?.additionalDelegates ?? {}),
    }
    const initialisationInfo = await this.crypto.xapi.entityWithInitialisedEncryptedMetadata(
      helement,
      EntityWithDelegationTypeName.HealthElement,
      patient.id,
      sfk,
      true,
      extraDelegations,
      options.alternateRootDelegation
    )
    return new models.HealthElement(initialisationInfo.updatedEntity)
  }

  /**
   * @throws always. Use {@link createHealthElementWithUser} instead.
   */
  createHealthElement(body?: models.HealthElement): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  /**
   * Creates a health element after encrypting its content.
   * @param user the current user, used for encryption.
   * @param body the health element to create.
   * @return the created and decrypted health element.
   */
  createHealthElementWithUser(user: models.User, body?: models.HealthElement): Promise<models.HealthElement | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((hes) => super.createHealthElement(hes[0]))
          .then((he) => this.decryptWithUser(user, [he]))
          .then((hes) => hes[0])
      : Promise.resolve(null)
  }

  /**
   * @throws always. Use {@link createHealthElementsWithUser} instead.
   */
  createHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  /**
   * Creates multiple health elements after encrypting their content.
   * @param user the current user, used for encryption.
   * @param bodies the health elements to create.
   * @return the created and decrypted health elements.
   */
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

  /**
   * @throws always. Use {@link getHealthElementWithUser} instead.
   */
  getHealthElement(healthElementId: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  /**
   * Retrieves a health element by id and decrypts it.
   * @param user the current user, used for decryption.
   * @param healthElementId the id of the health element to retrieve.
   * @return the decrypted health element.
   */
  getHealthElementWithUser(user: models.User, healthElementId: string): Promise<models.HealthElement> {
    return super
      .getHealthElement(healthElementId)
      .then((he) => this.decryptWithUser(user, [he]))
      .then((hes) => hes[0])
  }

  /**
   * @throws always. Use {@link getHealthElementsWithUser} instead.
   */
  getHealthElements(body?: models.ListOfIds): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  /**
   * Retrieves multiple health elements by their ids and decrypts them.
   * @param user the current user, used for decryption.
   * @param body the list of health element ids to retrieve.
   * @return the decrypted health elements.
   */
  getHealthElementsWithUser(user: models.User, body?: models.ListOfIds): Promise<models.HealthElement[]> {
    return super.getHealthElements(body).then((hes) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes))
  }

  /**
   * @throws always.
   */
  newHealthElementDelegations(healthElementId: string, body?: Array<models.Delegation>): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  /**
   * @throws always. Use {@link findHealthElementsByHCPartyPatientForeignKeysWithUser} instead.
   */
  findHealthElementsByHCPartyPatientForeignKeys(hcPartyId: string, secretFKeys: string): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  /**
   * @deprecated use {@link findHealthElementIdsByDataOwnerPatientOpeningDate} instead.
   */
  findHealthElementsByHCPartyPatientForeignKeysWithUser(user: models.User, hcPartyId: string, secretFKeys: string): Promise<HealthElement[]> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((hes) => this.decryptWithUser(user, hes))
  }

  /**
   * @deprecated use {@link findHealthElementIdsByDataOwnerPatientOpeningDate} instead.
   */
  findHealthElementsByHCPartyPatientForeignKeysArrayWithUser(user: models.User, hcPartyId: string, secretFKeys: string[]): Promise<HealthElement[]> {
    return super.findHealthElementsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys).then((hes) => this.decryptWithUser(user, hes))
  }

  /**
   * Finds all health elements for a given patient and healthcare party, and decrypts them.
   * @deprecated use {@link findHealthElementIdsByDataOwnerPatientOpeningDate} instead.
   * @param user the current user, used for decryption.
   * @param hcPartyId the id of the healthcare party.
   * @param patient the patient whose health elements to find.
   * @param usingPost if true, uses POST instead of GET for the request.
   * @return the decrypted health elements.
   */
  async findHealthElementsByHCPartyAndPatientWithUser(
    user: models.User,
    hcPartyId: string,
    patient: models.Patient,
    usingPost: boolean = false
  ): Promise<models.HealthElement[]> {
    let keysAndHcPartyId = await this.crypto.xapi.secretIdsForHcpHierarchyOf({ entity: patient, type: EntityWithDelegationTypeName.Patient })
    const keys = keysAndHcPartyId.find((secretForeignKeys) => secretForeignKeys.ownerId == hcPartyId)?.extracted
    if (keys == undefined) {
      throw Error('No delegation for user')
    }
    return usingPost
      ? this.findHealthElementsByHCPartyPatientForeignKeysArrayWithUser(user, hcPartyId, keys)
      : this.findHealthElementsByHCPartyPatientForeignKeysWithUser(user, hcPartyId, keys.join(','))
  }

  /**
   * @throws always. Use {@link modifyHealthElementWithUser} instead.
   */
  modifyHealthElement(body?: HealthElement): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  /**
   * Modifies a health element after encrypting its content.
   * @param user the current user, used for encryption/decryption.
   * @param body the health element with updated fields.
   * @return the modified and decrypted health element, or null if body was not provided.
   */
  modifyHealthElementWithUser(user: models.User, body?: HealthElement): Promise<HealthElement | any> {
    return body ? this.modifyHealthElementAs(this.dataOwnerApi.getDataOwnerIdOf(user), body) : Promise.resolve(null)
  }
  private modifyHealthElementAs(dataOwner: string, body: HealthElement): Promise<HealthElement> {
    return this.encryptAs(dataOwner, [_.cloneDeep(body)])
      .then((hes) => super.modifyHealthElement(hes[0]))
      .then((he) => this.decrypt(dataOwner, [he]))
      .then((hes) => hes[0])
  }

  /**
   * @throws always. Use {@link modifyHealthElementsWithUser} instead.
   */
  modifyHealthElements(body?: Array<HealthElement>): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  /**
   * Modifies multiple health elements after encrypting their content.
   * @param user the current user, used for encryption/decryption.
   * @param bodies the health elements with updated fields.
   * @return the modified and decrypted health elements, or null if bodies was not provided.
   */
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
   * @deprecated use {@link findIdsBy}.
   * @param hcpartyId
   * @param patient (Promise)
   * @param keepObsoleteVersions
   * @param usingPost
   */
  findBy(hcpartyId: string, patient: models.Patient, keepObsoleteVersions = false, usingPost = false) {
    return this.crypto.xapi
      .secretIdsForHcpHierarchyOf({ entity: patient, type: EntityWithDelegationTypeName.Patient })
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

  /**
   * Same as {@link findBy} but it will only return the ids of the health elements. It can also filter the health elements where HealthElement.openingDate is between
   * startDate and endDate in ascending or descending order by that field. (default: ascending).
   */
  async findIdsBy(hcpartyId: string, patient: models.Patient, startDate?: number, endDate?: number, descending?: boolean) {
    return this.crypto.xapi.secretIdsForHcpHierarchyOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }).then((secretForeignKeys) =>
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
                this.findHealthElementIdsByDataOwnerPatientOpeningDate(hcpartyId, extractedKeys, startDate, endDate, descending)
              )
          ).then((results) => _.uniq(_.flatMap(results)))
        : Promise.resolve([])
    )
  }

  /**
   * @deprecated use {@link findHealthElementIdsByDataOwnerPatientOpeningDate} instead.
   */
  findByHCPartyPatientSecretFKeys(hcPartyId: string, secretFKeys: string): Promise<Array<models.HealthElement> | any> {
    return super.findHealthElementsByHCPartyPatientForeignKeys(hcPartyId, secretFKeys).then((helements) => this.decrypt(hcPartyId, helements))
  }

  /**
   * @deprecated use {@link findHealthElementIdsByDataOwnerPatientOpeningDate} instead.
   */
  findByHCPartyPatientSecretFKeysArray(hcPartyId: string, secretFKeys: string[]): Promise<Array<models.Contact> | any> {
    return super
      .findHealthElementsByHCPartyPatientForeignKeysUsingPost(hcPartyId, secretFKeys)
      .then((helements) => this.decrypt(hcPartyId, helements))
  }

  /**
   * Encrypts the encrypted fields of a list of health elements.
   * @param user the current user, used to determine the data owner for encryption.
   * @param healthElements the health elements to encrypt.
   * @return the encrypted health elements.
   */
  encrypt(user: models.User, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.encryptAs(this.dataOwnerApi.getDataOwnerIdOf(user), healthElements)
  }

  private encryptAs(owner: string, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.crypto.xapi.tryEncryptEntities(
      healthElements,
      EntityWithDelegationTypeName.HealthElement,
      this.encryptedFields,
      false,
      false,
      (x) => new models.HealthElement(x)
    )
  }

  /**
   * Decrypts a list of health elements using the given user's data owner keys.
   * @param user the current user.
   * @param hes the health elements to decrypt.
   * @return the decrypted health elements.
   */
  decryptWithUser(user: models.User, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), hes)
  }

  /**
   * Decrypts a list of health elements using the current data owner's keys.
   * @param dataOwnerId the id of the data owner performing the decryption.
   * @param hes the health elements to decrypt.
   * @return the decrypted health elements.
   */
  async decrypt(dataOwnerId: string, hes: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    return (await this.crypto.xapi.tryDecryptEntities(hes, EntityWithDelegationTypeName.HealthElement, (x) => new models.HealthElement(x))).map(
      ({ entity }) => entity
    )
  }

  /**
   * @throws always. Use {@link filterByWithUser} instead.
   */
  filterHealthElementsBy(startDocumentId?: string, limit?: number, body?: FilterChainHealthElement): never {
    throw new Error('Cannot call a method that returns health elements without providing a user for de/encryption')
  }

  /**
   * Filters health elements using the provided filter chain and decrypts the results.
   * @param user the current user, used for decryption.
   * @param startDocumentId the pagination start document id.
   * @param limit the maximum number of results to return.
   * @param body the filter chain to apply.
   * @param collectTiming add timing information to the response
   * @return a paginated list of decrypted health elements.
   */
  filterByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainHealthElement,
    collectTiming?: false
  ): Promise<PaginatedListHealthElement>
  filterByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainHealthElement,
    collectTiming?: true
  ): Promise<PaginatedListHealthElement & TimingInfo>
  filterByWithUser(
    user: models.User,
    startDocumentId?: string,
    limit?: number,
    body?: FilterChainHealthElement,
    collectTiming: boolean = false
  ): Promise<PaginatedListHealthElement> {
    return super
      .filterHealthElementsBy(startDocumentId, limit, body, collectTiming as any)
      .then((pl) => this.decryptWithUser(user, pl.rows!).then((dr) => Object.assign(pl, { rows: dr })))
  }

  /**
   * Converts a service into a new health element linked to the given patient.
   * @param user the current user.
   * @param patient the patient to link the health element to.
   * @param heSvc the service to convert.
   * @param descr the description for the new health element.
   * @return the created health element.
   */
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

  /**
   * Parses a pipe-delimited code string into a Code object.
   * @param code the code string in format "type|code|version".
   * @return a Code object with the parsed fields.
   */
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
    return this.crypto.xapi.owningEntityIdsOf({ entity: healthElement, type: EntityWithDelegationTypeName.HealthElement }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given health element
   */
  async hasWriteAccess(healthElement: models.HealthElement): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: healthElement, type: EntityWithDelegationTypeName.HealthElement })
  }

  /**
   * Share an existing health element with other data owners, allowing them to access the non-encrypted data of the health element and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the health element.
   * @param healthElement the health element to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * health element does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this health element refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    healthElement: models.HealthElement,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.HealthElement> {
    return this.shareWithMany(healthElement, { [delegateId]: options })
  }
  /**
   * Share an existing health element with other data owners, allowing them to access the non-encrypted data of the health element and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the health element.
   * @param healthElement the health element to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * health element does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this health element refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    healthElement: models.HealthElement,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.HealthElement> {
    return (await this.tryShareWithMany(healthElement, delegates)).updatedEntityOrThrow
  }
  /**
   * Share an existing health element with other data owners, allowing them to access the non-encrypted data of the health element and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param healthElement the health element to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * health element does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this health element refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    healthElement: models.HealthElement,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.HealthElement>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(healthElement, EntityWithDelegationTypeName.HealthElement)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyHealthElementAs(self, entityWithEncryptionKey) : healthElement
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.HealthElement,
        },
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: options.shareSecretIds,
            },
          ])
        ),
        (x) => this.bulkShareHealthElements(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  /**
   * Retrieves the data owners that have access to the given health element, along with their access levels.
   * @param entity the health element.
   * @return an object containing a map of data owner ids to their access levels, and a flag indicating if there are unknown anonymous data owners.
   */
  getDataOwnersWithAccessTo(
    entity: models.HealthElement
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.HealthElement })
  }

  /**
   * Retrieves the encryption keys of the given health element.
   * @param entity the health element.
   * @return the encryption key ids.
   */
  getEncryptionKeysOf(entity: models.HealthElement): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.HealthElement }, undefined)
  }

  /**
   * Subscribes to real-time health element events using a WebSocket connection. Received events are automatically decrypted.
   * @param eventTypes the types of events to listen for (e.g. 'CREATE', 'UPDATE', 'DELETE').
   * @param filter an optional filter to restrict which health element events trigger the callback.
   * @param eventFired the callback function invoked when a matching health element event is received.
   * @param options optional subscription configuration such as connection parameters and retry behaviour.
   * @return a connection object that can be used to manage the WebSocket subscription lifecycle.
   */
  async subscribeToHealthElementEvents(
    eventTypes: ('CREATE' | 'UPDATE' | 'DELETE')[],
    filter: AbstractFilter<HealthElement> | undefined,
    eventFired: (healthElement: HealthElement) => Promise<void>,
    options: SubscriptionOptions = {}
  ): Promise<Connection> {
    const currentUser = await this.userApi.getCurrentUser()

    return await subscribeToEntityEvents(
      this.host,
      this.authApi,
      EntityWithDelegationTypeName.HealthElement,
      eventTypes,
      filter,
      eventFired,
      options,
      async (encrypted) => (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(currentUser), [encrypted]))[0]
    ).then((rs) => new ConnectionImpl(rs))
  }

  /**
   * Creates or updates de-anonymization metadata for the given health element, allowing the specified delegates to
   * identify the data owners that have access to it.
   * @param entity the health element.
   * @param delegates the data owner ids for which to create de-anonymization metadata.
   */
  createDelegationDeAnonymizationMetadata(entity: HealthElement, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo(
      { entity, type: EntityWithDelegationTypeName.HealthElement },
      delegates
    )
  }
}
