import * as i18n from './rsrc/contact.i18n'

import * as _ from 'lodash'
import { IccTimeTableApi } from '../icc-api'
import { User } from '../icc-api/model/User'
import { TimeTable } from '../icc-api/model/TimeTable'
import { IccCryptoXApi } from './icc-crypto-x-api'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
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

  newInstance(user: User, tt: TimeTable) {
    const timeTable = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.TimeTable',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      tt || {}
    )

    return this.crypto.initObjectDelegations(timeTable, null, this.dataOwnerApi.getDataOwnerOf(user), null).then((initData) => {
      _.extend(timeTable, { delegations: initData.delegations })

      let promise = Promise.resolve(timeTable)
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise
            .then((patient) =>
              this.crypto.extendedDelegationsAndCryptedForeignKeys(
                patient,
                null,
                this.dataOwnerApi.getDataOwnerOf(user),
                delegateId,
                initData.secretId
              )
            )
            .then((extraData) => _.extend(timeTable, { delegations: extraData.delegations })))
      )
      return promise
    })
  }
}
