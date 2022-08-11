import { IccReceiptApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'
import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'

export class IccReceiptXApi extends IccReceiptApi {
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
    this.dataOwnerApi = dataOwnerApi
  }

  newInstance(user: models.User, r: any): Promise<models.Receipt> {
    const receipt = new models.Receipt(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.Receipt',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: this.dataOwnerApi.getDataOwnerOf(user),
          author: user.id,
          codes: [],
          tags: [],
        },
        r || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, receipt)
  }

  initEncryptionKeys(user: models.User, rcpt: models.Receipt) {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return this.crypto.initEncryptionKeys(rcpt, dataOwnerId).then((eks) => {
      let promise = Promise.resolve(
        _.extend(rcpt, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((receipt) =>
            this.crypto.appendEncryptionKeys(receipt, dataOwnerId, delegateId, eks.secretId).then((extraEks) => {
              return _.extend(receipt, {
                encryptionKeys: extraEks.encryptionKeys,
              })
            })
          ))
      )
      return promise
    })
  }

  private initDelegationsAndEncryptionKeys(user: models.User, receipt: models.Receipt): Promise<models.Receipt> {
    const dataOwnerId = this.dataOwnerApi.getDataOwnerOf(user)

    return Promise.all([
      this.crypto.initObjectDelegations(receipt, null, dataOwnerId, null),
      this.crypto.initEncryptionKeys(receipt, dataOwnerId),
    ]).then((initData) => {
      const dels = initData[0]
      const eks = initData[1]
      _.extend(receipt, {
        delegations: dels.delegations,
        cryptedForeignKeys: dels.cryptedForeignKeys,
        secretForeignKeys: dels.secretForeignKeys,
        encryptionKeys: eks.encryptionKeys,
      })

      let promise = Promise.resolve(receipt)
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.medicalInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((receipt) =>
            this.crypto.addDelegationsAndEncryptionKeys(null, receipt, dataOwnerId, delegateId, dels.secretId, eks.secretId).catch((e) => {
              console.log(e)
              return receipt
            })
          ))
      )
      return promise
    })
  }

  logReceipt(user: models.User, docId: string, refs: Array<string>, blobType: string, blob: ArrayBuffer) {
    return this.newInstance(user, { documentId: docId, references: refs })
      .then((rcpt) => this.createReceipt(rcpt))
      .then((rcpt) => (blob.byteLength != 0 ? this.setReceiptAttachment(rcpt.id!, blobType, '', <any>blob) : Promise.resolve(rcpt)))
  }
}
