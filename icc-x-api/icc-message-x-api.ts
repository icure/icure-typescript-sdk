import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import { AccessLog, Patient, User } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider } from './auth/AuthenticationProvider'
import * as models from '../icc-api/model/models'

export class IccMessageXApi extends IccMessageApi {
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    authenticationProvider: AuthenticationProvider,
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

  async newInstanceWithPatient(
    user: User,
    patient: Patient | null,
    m: any = {},
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Message',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      m || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const sfk = preferredSfk ?? (patient ? (await this.crypto.entities.secretIdsOf(patient, ownerId))[0] : undefined)
    // TODO sure this should be medical?
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])]
    // TODO data is never encrypted, but should we initialise encryption keys anyway, to have everything future proof?
    return new models.Message(
      await this.crypto.entities
        .entityWithInitialisedEncryptionMetadata(message, patient?.id, sfk, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }
}
