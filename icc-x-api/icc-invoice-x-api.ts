import { IccEntityrefApi, IccInvoiceApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { Invoice } from '../icc-api/model/models'
import { IccUserXApi } from './icc-user-x-api'

export class IccInvoiceXApi extends IccInvoiceApi {
  crypto: IccCryptoXApi
  entityrefApi: IccEntityrefApi
  userApi: IccUserXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    entityrefApi: IccEntityrefApi,
    userApi: IccUserXApi,
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, fetchImpl)
    this.crypto = crypto
    this.entityrefApi = entityrefApi
    this.userApi = userApi
  }

  newInstance(user: models.User, patient: models.Patient, inv: any = {}, delegates: string[] = []): Promise<models.Invoice> {
    const invoice = new models.Invoice(
      _.extend(
        {
          id: this.crypto.randomUuid(),
          groupId: this.crypto.randomUuid(),
          _type: 'org.taktik.icure.entities.Invoice',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: this.userApi.getDataOwnerOf(user),
          author: user.id,
          codes: [],
          tags: [],
          invoicingCodes: [],
        },
        inv || {}
      )
    )

    return this.initDelegationsAndEncryptionKeys(user, patient, invoice, delegates)
  }

  initEncryptionKeys(user: models.User, invoice: models.Invoice) {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto.initEncryptionKeys(invoice, dataOwnerId!).then((eks) => {
      let promise = Promise.resolve(
        _.extend(invoice, {
          encryptionKeys: eks.encryptionKeys,
        })
      )
      ;(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.financialInformation || []) : []).forEach(
        (delegateId) =>
          (promise = promise.then((invoice) =>
            this.crypto.appendEncryptionKeys(invoice, dataOwnerId!, delegateId, eks.secretId).then((extraEks) => {
              return _.extend(invoice, {
                encryptionKeys: extraEks.encryptionKeys,
              })
            })
          ))
      )
      return promise
    })
  }

  private initDelegationsAndEncryptionKeys(
    user: models.User,
    patient: models.Patient,
    invoice: models.Invoice,
    delegates: string[] = []
  ): Promise<models.Invoice> {
    const dataOwnerId = this.userApi.getDataOwnerOf(user)
    return this.crypto
      .extractDelegationsSFKs(patient, dataOwnerId)
      .then((secretForeignKeys) =>
        Promise.all([
          this.crypto.initObjectDelegations(invoice, patient, dataOwnerId!, secretForeignKeys.extractedKeys[0]),
          this.crypto.initEncryptionKeys(invoice, dataOwnerId!),
        ])
      )
      .then((initData) => {
        const dels = initData[0]
        const eks = initData[1]
        _.extend(invoice, {
          delegations: dels.delegations,
          cryptedForeignKeys: dels.cryptedForeignKeys,
          secretForeignKeys: dels.secretForeignKeys,
          encryptionKeys: eks.encryptionKeys,
        })

        let promise = Promise.resolve(invoice)
        _.uniq(
          delegates.concat(user.autoDelegations ? (user.autoDelegations.all || []).concat(user.autoDelegations.financialInformation || []) : [])
        ).forEach(
          (delegateId) =>
            (promise = promise.then((invoice) =>
              this.crypto.addDelegationsAndEncryptionKeys(patient, invoice, dataOwnerId!, delegateId, dels.secretId, eks.secretId).catch((e) => {
                console.log(e)
                return invoice
              })
            ))
        )
        return promise
      })
  }

  createInvoice(invoice: Invoice, prefix?: string): Promise<Invoice> {
    if (!prefix) {
      return super.createInvoice(invoice)
    }
    if (!invoice.id) {
      invoice.id = this.crypto.randomUuid()
    }
    return this.getNextInvoiceReference(prefix, this.entityrefApi)
      .then((reference) => this.createInvoiceReference(reference, invoice.id!, prefix, this.entityrefApi))
      .then((entityReference) => {
        if (!entityReference.id) {
          throw new Error('Cannot create invoice')
        }

        if (invoice.internshipNihii) {
          const ref = entityReference.id.substr(prefix.length).replace('0', '1')
          invoice.invoiceReference = ref
        } else {
          invoice.invoiceReference = entityReference.id.substr(prefix.length)
        }
        return super.createInvoice(invoice)
      })
  }

  getNextInvoiceReference(prefix: string, entityrefApi: IccEntityrefApi): Promise<number> {
    return entityrefApi.getLatest(prefix).then((entRef: models.EntityReference) => {
      if (!entRef || !entRef.id || !entRef.id!.startsWith(prefix)) return 1
      const sequenceNumber = entRef.id!.split(':').pop() || 0
      return Number(sequenceNumber) + 1
    })
  }

  createInvoiceReference(nextReference: number, docId: string, prefix: string, entityrefApi: IccEntityrefApi): Promise<models.EntityReference> {
    return entityrefApi
      .createEntityReference(
        new models.EntityReference({
          id: prefix + nextReference.toString().padStart(6, '0'),
          docId,
        })
      )
      .catch((err) => {
        console.log(err)
        return this.createInvoiceReference(nextReference + 1, docId, prefix, entityrefApi)
      })
  }

  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all invoices with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the invoices of the patient.
   *
   * @param hcpartyId
   * @param patient (Promise)
   */
  findBy(hcpartyId: string, patient: models.Patient): Promise<Array<models.Invoice>> {
    return this.crypto
      .extractDelegationsSFKs(patient, hcpartyId)
      .then((secretForeignKeys) =>
        this.findInvoicesByHCPartyPatientForeignKeys(secretForeignKeys.hcpartyId!, _.uniq(secretForeignKeys.extractedKeys).join(','))
      )
      .then((invoices) => this.decrypt(hcpartyId, invoices))
      .then(function (decryptedInvoices) {
        return decryptedInvoices
      })
  }

  encrypt(user: models.User, invoices: Array<models.Invoice>) {
    return Promise.resolve(invoices)
  }

  decrypt(hcpartyId: string, invoices: Array<models.Invoice>): Promise<Array<models.Invoice>> {
    return Promise.resolve(invoices)
  }
}
