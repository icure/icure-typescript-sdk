import { IccFormApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'

import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

// noinspection JSUnusedGlobalSymbols
export class IccFormXApi extends IccFormApi {
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

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
   * Creates a new instance of form with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this form refers to.
   * @param c initialised data for the form. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the form other than the current data owner.
   * @param preferredSfk secret id of the patient to use as the secret foreign key to use for the form. The default value will be a secret
   * id of patient known by the topmost parent in the current data owner hierarchy.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of form.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ) {
    const form = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Form',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      c || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new models.Form(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(form, patient.id, sfk, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
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
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   *
   * @param hcpartyId
   * @param patient
   * @param usingPost (Promise)
   */
  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    let forms: Array<models.Form> = usingPost
      ? await this.findFormsByHCPartyPatientForeignKeysUsingPost(topmostParentId, undefined, undefined, undefined, _.uniq(extractedKeys))
      : await this.findFormsByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
    return await this.decrypt(hcpartyId, forms)
  }

  decrypt(hcpartyId: string, forms: Array<models.Form>) {
    return Promise.all(
      forms.map((form) => this.crypto.entities.decryptEntity(form, hcpartyId, (x) => new models.Form(x)).then(({ entity }) => entity))
    )
  }
}
