import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import { Patient, User } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import * as models from '../icc-api/model/models'

export class IccMessageXApi extends IccMessageApi {
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
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

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: User, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  /**
   * Creates a new instance of message with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this message refers to.
   * @param m initialised data for the message. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the message other than the current data owner.
   * @param preferredSfk secret id of the patient to use as the secret foreign key to use for the message. The default value will be a secret
   * id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of message.
   */
  async newInstanceWithPatient(user: User, patient: Patient | null, m: any = {}, delegates: string[] = [], preferredSfk?: string) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Message',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      m || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient ? preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents(patient)) : undefined
    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    return new models.Message(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(message, patient?.id, sfk, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }
}
