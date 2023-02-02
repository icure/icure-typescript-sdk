import { IccHelementApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { HealthElement } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccHelementXApi extends IccHelementApi {
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  private readonly encryptedKeys: Array<string>

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
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
    this.encryptedKeys = encryptedKeys
  }

  /**
   * Temporary version of new instance without the `confidential` parameter, to simplify the transition to the updated api. In a future version
   * the confidential parameter from new instance will be removed and this will be deprecated.
   */
  async newInstanceNoConfidential(
    user: models.User,
    patient: models.Patient,
    h: any,
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ) {
    return this.newInstance(user, patient, h, false, delegates, preferredSfk, delegationTags)
  }

  /**
   * Creates a new instance of health element with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this health element refers to.
   * @param h initialised data for the health element. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param confidential if false the new health element will automatically be shared with all auto-delegations for the current user, and the default
   * sfk will be a secret id of patient known by the topmost parent in the current data owner hierarchy. If true the new health element won't be
   * shared with any of the auto delegations and the default sfk will be a confidential secret id of patient for the current data owner.
   * @param delegates initial delegates which will have access to the health element other than the current data owner. Note that if you are using the
   * default confidential secret foreign keys the delegates may not be able to find the health element.
   * @param preferredSfk secret id of the patient to use as the secret foreign key to use for the health element. If provided overrides the default
   * value, regardless of the value of {@link confidential}
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of health element.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    h: any,
    confidential = false,
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    const helement = _.assign(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.HealthElement',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: dataOwnerId,
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.primitives.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      h || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk =
      preferredSfk ??
      (confidential
        ? await this.crypto.confidential.getConfidentialSecretId(patient)
        : await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id} for confidential=${confidential}`)
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    const initialisationInfo = await this.crypto.entities.entityWithInitialisedEncryptedMetadata(
      helement,
      patient.id,
      sfk,
      true,
      confidential ? [] : extraDelegations,
      delegationTags
    )
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

  async findHealthElementsByHCPartyAndPatientWithUser(
    user: models.User,
    hcPartyId: string,
    patient: models.Patient
  ): Promise<models.HealthElement[]> {
    let keysAndHcPartyId = await this.crypto.entities.secretIdsForHcpHierarchyOf(patient)
    const keys = keysAndHcPartyId.find((secretForeignKeys) => secretForeignKeys.ownerId == hcPartyId)?.extracted
    if (keys == undefined) {
      throw Error('No delegation for user')
    }
    return this.findHealthElementsByHCPartyPatientForeignKeysWithUser(user, hcPartyId, keys.join(','))
  }

  modifyHealthElement(body?: HealthElement): never {
    throw new Error('Cannot call a method that returns health element without providing a user for de/encryption')
  }

  modifyHealthElementWithUser(user: models.User, body?: HealthElement): Promise<HealthElement | any> {
    return body
      ? this.encrypt(user, [_.cloneDeep(body)])
          .then((hes) => super.modifyHealthElement(hes[0]))
          .then((he) => this.decryptWithUser(user, [he]))
          .then((hes) => hes[0])
      : Promise.resolve(null)
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
   */

  findBy(hcpartyId: string, patient: models.Patient, keepObsoleteVersions = false) {
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
                .map(({ hcpartyId, extractedKeys }) => this.findByHCPartyPatientSecretFKeys(hcpartyId, _.uniq(extractedKeys).join(',')))
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

  encrypt(user: models.User, healthElements: Array<models.HealthElement>): Promise<Array<models.HealthElement>> {
    const owner = this.dataOwnerApi.getDataOwnerIdOf(user)
    return Promise.all(
      healthElements.map((he) =>
        this.crypto.entities.tryEncryptEntity(he, owner, this.encryptedKeys, false, true, (x) => new models.HealthElement(x))
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
}
