import { IccEntityrefApi, IccInvoiceApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'
import { Invoice } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'

export class IccInvoiceXApi extends IccInvoiceApi implements EncryptedEntityXApi<models.Invoice> {
  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, 'Invoice'))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    private readonly crypto: IccCryptoXApi,
    private readonly entityrefApi: IccEntityrefApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly autofillAuthor: boolean,
    authenticationProvider: AuthenticationProvider = new NoAuthenticationProvider(),
    fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = typeof window !== 'undefined'
      ? window.fetch
      : typeof self !== 'undefined'
      ? self.fetch
      : fetch
  ) {
    super(host, headers, authenticationProvider, fetchImpl)
  }

  /**
   * Creates a new instance of invoice with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this invoice refers to.
   * @param inv initialised data for the invoice. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the invoice. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of invoice.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    inv: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ): Promise<models.Invoice> {
    const invoice = new models.Invoice({
      ...(inv ?? {}),
      _type: 'org.taktik.icure.entities.Invoice',
      id: inv?.id ?? this.crypto.primitives.randomUuid(),
      groupId: inv?.groupId ?? this.crypto.primitives.randomUuid(),
      created: inv?.created ?? new Date().getTime(),
      modified: inv?.modified ?? new Date().getTime(),
      responsible: inv?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: inv?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: inv?.codes ?? [],
      tags: inv?.tags ?? [],
      invoicingCodes: inv?.invoicingCodes ?? [],
    })

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = options.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: 'Patient' }))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.financialInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Invoice(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(invoice, 'Invoice', patient.id, sfk, true, false, extraDelegations)
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
   * @param usingPost
   */
  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false): Promise<Array<models.Invoice>> {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: 'Patient' }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    let invoices: Array<Invoice> = usingPost
      ? await this.findInvoicesByHCPartyPatientForeignKeysUsingPost(hcpartyId!, _.uniq(extractedKeys))
      : await this.findInvoicesByHCPartyPatientForeignKeys(hcpartyId!, _.uniq(extractedKeys).join(','))
    return await this.decrypt(hcpartyId, invoices)
  }

  encrypt(user: models.User, invoices: Array<models.Invoice>) {
    return Promise.resolve(invoices)
  }

  decrypt(hcpartyId: string, invoices: Array<models.Invoice>): Promise<Array<models.Invoice>> {
    return Promise.resolve(invoices)
  }

  /**
   * @param invoice a invoice
   * @return the id of the patient that the invoice refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(invoice: models.Invoice): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: invoice, type: 'Invoice' }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given invoice
   */
  async hasWriteAccess(invoice: models.Invoice): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: invoice, type: 'Invoice' })
  }

  /**
   * Share an existing invoice with other data owners, allowing them to access the non-encrypted data of the invoice and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the invoice.
   * @param invoice the invoice to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * invoice does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this invoice refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    invoice: models.Invoice,
    options: {
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Invoice> {
    return this.shareWithMany(invoice, { [delegateId]: options })
  }

  /**
   * Share an existing invoice with other data owners, allowing them to access the non-encrypted data of the invoice and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param invoice the invoice to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * invoice does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this invoice refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    invoice: models.Invoice,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Invoice> {
    return (await this.tryShareWithMany(invoice, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing invoice with other data owners, allowing them to access the non-encrypted data of the invoice and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param invoice the invoice to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * invoice does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this invoice refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    invoice: models.Invoice,
    delegates: {
      [delegateId: string]: {
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Invoice>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(invoice, 'Invoice')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyInvoice(entityWithEncryptionKey) : invoice
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        { entity: updatedEntity, type: 'Invoice' },
        true,
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: undefined,
            },
          ])
        ),
        (x) => this.bulkShareInvoices(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: models.Invoice
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.xapi.getDataOwnersWithAccessTo({ entity, type: 'Invoice' })
  }

  getEncryptionKeysOf(entity: models.Invoice): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: 'Invoice' }, undefined)
  }
}
