import { IccEntityrefApi, IccInvoiceApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { Invoice } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider } from './auth/AuthenticationProvider'

export class IccInvoiceXApi extends IccInvoiceApi {
  crypto: IccCryptoXApi
  entityrefApi: IccEntityrefApi
  dataOwnerApi: IccDataOwnerXApi

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    entityrefApi: IccEntityrefApi,
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
    this.entityrefApi = entityrefApi
    this.dataOwnerApi = dataOwnerApi
  }

  async newInstance(
    user: models.User,
    patient: models.Patient,
    inv: any = {},
    delegates: string[] = [],
    preferredSfk?: string,
    delegationTags?: string[]
  ): Promise<models.Invoice> {
    const invoice = new models.Invoice(
      _.extend(
        {
          id: this.crypto.primitives.randomUuid(),
          groupId: this.crypto.primitives.randomUuid(),
          _type: 'org.taktik.icure.entities.Invoice',
          created: new Date().getTime(),
          modified: new Date().getTime(),
          responsible: this.dataOwnerApi.getDataOwnerOf(user),
          author: user.id,
          codes: [],
          tags: [],
          invoicingCodes: [],
        },
        inv || {}
      )
    )

    const ownerId = this.dataOwnerApi.getDataOwnerOf(user)
    const sfk = preferredSfk ?? (await this.crypto.entities.secretIdsOf(patient, ownerId))[0]
    const extraDelegations = [...delegates, ...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.financialInformation ?? [])]
    // TODO data is never encrypted should we really initialise encryption keys?
    return new models.Invoice(
      await this.crypto.entities
        .entityWithInitialisedEncryptedMetadata(invoice, patient.id, sfk, true, extraDelegations, delegationTags)
        .then((x) => x.updatedEntity)
    )
  }

  createInvoice(invoice: Invoice, prefix?: string): Promise<Invoice> {
    if (!prefix) {
      return super.createInvoice(invoice)
    }
    if (!invoice.id) {
      invoice.id = this.crypto.primitives.randomUuid()
    }
    return this.getNextInvoiceReference(prefix, this.entityrefApi)
      .then((reference) => this.createInvoiceReference(reference, invoice.id!, prefix, this.entityrefApi))
      .then((entityReference) => {
        if (!entityReference.id) {
          throw new Error('Cannot create invoice')
        }

        if (invoice.internshipNihii) {
          invoice.invoiceReference = entityReference.id.substring(prefix.length).replace('0', '1')
        } else {
          invoice.invoiceReference = entityReference.id.substring(prefix.length)
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
  async findBy(hcpartyId: string, patient: models.Patient): Promise<Array<models.Invoice>> {
    const extractedKeys = await this.crypto.entities.secretIdsOf(patient, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0] // TODO should this really be topmost parent?
    let invoices: Array<Invoice> = await this.findInvoicesByHCPartyPatientForeignKeys(topmostParentId, _.uniq(extractedKeys).join(','))
    return await this.decrypt(hcpartyId, invoices)
  }

  encrypt(user: models.User, invoices: Array<models.Invoice>) {
    return Promise.resolve(invoices)
  }

  decrypt(hcpartyId: string, invoices: Array<models.Invoice>): Promise<Array<models.Invoice>> {
    return Promise.resolve(invoices)
  }
}
