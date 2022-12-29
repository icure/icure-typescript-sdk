import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import { IccTimeTableApi } from '../icc-api'
import { User } from '../icc-api/model/User'
import { TimeTable } from '../icc-api/model/TimeTable'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import * as models from '../icc-api/model/models'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

export class IccTimeTableXApi extends IccTimeTableApi {
  i18n: any = i18n
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
   * Creates a new instance of timetable with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param tt initialised data for the timetable. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param delegates initial delegates which will have access to the timetable other than the current data owner.
   * @param delegationTags tags for the initialised delegations.
   * @return a new instance of timetable.
   */
  async newInstance(user: User, tt: TimeTable, delegates: string[] = [], delegationTags?: string[]) {
    const timeTable = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.TimeTable',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      tt || {}
    )

    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.administrativeData ?? [])]
    return new models.TimeTable(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(timeTable, undefined, undefined, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }
}
