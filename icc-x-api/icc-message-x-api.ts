import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import { Patient, User } from '../icc-api/model/models'
export class IccMessageXApi extends IccMessageApi {
  constructor(
    host: string,
    headers: { [key: string]: string },
    private crypto: IccCryptoXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
  }

  // noinspection JSUnusedGlobalSymbols
  newInstance(user: User, m: any) {
    return this.newInstanceWithPatient(user, null, m)
  }

  newInstanceWithPatient(user: User, patient: Patient | null, m: any) {
    const message = _.extend(
      {
        id: this.crypto.randomUuid(),
        _type: 'org.taktik.icure.entities.Message',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: user.healthcarePartyId,
        author: user.id,
        codes: [],
        tags: [],
      },
      m || {}
    )

    const hcpId = user.healthcarePartyId || user.patientId
    return this.crypto
      .extractDelegationsSFKs(patient, hcpId)
      .then((secretForeignKeys) => this.crypto.initObjectDelegations(message, patient, hcpId!, secretForeignKeys.extractedKeys[0]))
      .then((initData) => {
        _.extend(message, {
          delegations: initData.delegations,
          cryptedForeignKeys: initData.cryptedForeignKeys,
          secretForeignKeys: initData.secretForeignKeys,
        })

        let promise = Promise.resolve(message)
        ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
          (delegateId) =>
            (promise = promise.then((helement) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(helement, patient, hcpId!, delegateId, initData.secretId)
                .then((extraData) =>
                  _.extend(helement, {
                    delegations: extraData.delegations,
                    cryptedForeignKeys: extraData.cryptedForeignKeys,
                  })
                )
                .catch((e) => {
                  console.log(e)
                  return helement
                })
            ))
        )
        return promise
      })
  }
}
