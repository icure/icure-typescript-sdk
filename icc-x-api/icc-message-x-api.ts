import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'

export class IccMessageXApi extends IccMessageApi {
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.dataOwnerApi = dataOwnerApi
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: models.User, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  newInstanceWithPatient(user: models.User, patient: models.Patient | null, m: any = {}, delegates: string[] = []) {
    const message: models.Message = _.extend(
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

    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return this.crypto
      .extractDelegationsSFKs(patient, dataOwnerId)
      .then((secretForeignKeys) => this.crypto.initObjectDelegations(message, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0], "Message"))
      .then((initData) => {
        _.extend(message, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys,
        })

        let promise = Promise.resolve(message)
        _.uniq(
          delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : [])
        ).forEach(
          (delegateId) =>
            (promise = promise.then((message) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(message, patient, dataOwnerId!, delegateId, initData.secretId, "Message")
                .then((extraData) =>
                  _.extend(message, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys,
                  })
                )
                .catch((e) => {
                  console.log(e)
                  return message
                })
            ))
        )
        return promise
      })
  }
}
