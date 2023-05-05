import { IccClassificationApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import * as _ from 'lodash'
import * as moment from 'moment'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'

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
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used. Currently only WRITE access is supported, but in future also read
   * access will be possible.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the classification. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of classification.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: 'WRITE' }
      preferredSfk?: string
    } = {}
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
    const sfk = options.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [
      ...Object.keys(options.additionalDelegates ?? {}),
      ...(user.autoDelegations?.all ?? []),
      ...(user.autoDelegations?.medicalInformation ?? []),
    ]
    return new models.Classification(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(classification, patient?.id, sfk, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  async findBy(hcpartyId: string, patient: models.Patient) {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    return extractedKeys && extractedKeys.length > 0
      ? this.findClassificationsByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
      : Promise.resolve([])
  }
  /**
   * @param classification a classification
   * @return the id of the patient that the classification refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(classification: models.Classification): Promise<string[]> {
    return this.crypto.entities.owningEntityIdsOf(classification, undefined)
  }

  /**
   * Share an existing classification with other data owners, allowing them to access the non-encrypted data of the classification and optionally also
   * the encrypted content.
   * @param delegateId the id of the data owner which will be granted access to the classification.
   * @param classification the classification to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * classification does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this classification refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated classification.
   */
  async shareWith(
    delegateId: string,
    classification: models.Classification,
    options: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Classification> {
    return this.shareWithMany(classification, { [delegateId]: options })
  }
  /**
   * Share an existing classification with other data owners, allowing them to access the non-encrypted data of the classification and optionally also
   * the encrypted content.
   * @param classification the classification to share.
   * @param delegates sharing options for each delegate.
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * classification does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this classification refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the updated classification.
   */
  async shareWithMany(
    classification: models.Classification,
    delegates: {
      [delegateId: string]: {
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Classification> {
    return await this.modifyClassification(
      await this.crypto.entities.entityWithAutoExtendedEncryptedMetadata(
        classification,
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
    )
  }
}
