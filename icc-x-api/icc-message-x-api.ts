import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import { Patient, User } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'

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

  newInstanceWithPatient(user: User, patient: Patient | null, m: any = {}, delegates: string[] = []) {
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

    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return this.crypto
      .extractDelegationsSFKs(patient, dataOwnerId)
      .then(async (secretForeignKeys) => {
        const sfk = secretForeignKeys.extractedKeys[0]
        if (!!patient && !sfk) {
          await this.crypto.reportError('Get sfk for Message creation', [patient], dataOwnerId!)
          throw new Error("Could not find secret foreign key for patient '" + patient.id + "'")
        }
        return this.crypto.initObjectDelegations(message, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0])
      })
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
            (promise = promise.then((helement) =>
              this.crypto
                .extendedDelegationsAndCryptedForeignKeys(helement, patient, dataOwnerId!, delegateId, initData.secretId)
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
