import { IccClassificationApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccClassificationXApi extends IccClassificationApi {
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
   * Creates a new instance of classification with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this classification refers to.
   * @param c initialised data for the classification. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the classification other than the current data owner.
   * @param preferredSfk secret id of the patient to use as the secret foreign key to use for the classification. The default value will be a secret
   * id of patient known by the topmost parent in the current data owner hierarchy.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of classification.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ): Promise<models.Classification> {
    const classification = _.assign(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.Classification',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
        healthElementId: this.crypto.primitives.randomUuid(),
        openingDate: parseInt(moment().format('YYYYMMDDHHmmss')),
      },
      c || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new models.Classification(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(classification, patient?.id, sfk, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, 'Patient', hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? this.findClassificationsByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }
}
