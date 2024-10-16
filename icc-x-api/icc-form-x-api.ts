import { IccFormApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'
import * as models from '../icc-api/model/models'

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
import { EntityWithDelegationTypeName } from './utils'

// noinspection JSUnusedGlobalSymbols
export class IccFormXApi extends IccFormApi implements EncryptedEntityXApi<models.Form> {
  crypto: IccCryptoXApi
  dataOwnerApi: IccDataOwnerXApi

  get headers(): Promise<Array<XHR.Header>> {
    return super.headers.then((h) => this.crypto.accessControlKeysHeaders.addAccessControlKeysHeaders(h, EntityWithDelegationTypeName.Form))
  }

  constructor(
    host: string,
    headers: { [key: string]: string },
    crypto: IccCryptoXApi,
    dataOwnerApi: IccDataOwnerXApi,
    private readonly autofillAuthor: boolean,
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
   * Creates a new instance of form with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this form refers to.
   * @param c initialised data for the form. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param options optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the form. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of form.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ) {
    const form = {
      ...(c ?? {}),
      _type: 'org.taktik.icure.entities.Form',
      id: c?.id ?? this.crypto.primitives.randomUuid(),
      created: c?.created ?? new Date().getTime(),
      modified: c?.modified ?? new Date().getTime(),
      responsible: c?.responsible ?? (this.autofillAuthor ? this.dataOwnerApi.getDataOwnerIdOf(user) : undefined),
      author: c?.author ?? (this.autofillAuthor ? user.id : undefined),
      codes: c?.codes ?? [],
      tags: c?.tags ?? [],
    }

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk =
      options.preferredSfk ??
      (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: EntityWithDelegationTypeName.Patient }))
    if (!sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Form(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(form, EntityWithDelegationTypeName.Form, patient.id, sfk, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * 1. Check whether there is a delegation with 'hcpartyId' or not.
   * 2. 'fetchHcParty[hcpartyId][1]': is encrypted AES exchange key by RSA public key of him.
   * 3. Obtain the AES exchange key, by decrypting the previous step value with hcparty private key
   *      3.1.  KeyPair should be fetch from cache (in jwk)
   *      3.2.  if it doesn't exist in the cache, it has to be loaded from Browser Local store, and then import it to WebCrypto
   * 4. Obtain the array of delegations which are delegated to his ID (hcpartyId) in this patient
   * 5. Decrypt and collect all keys (secretForeignKeys) within delegations of previous step (with obtained AES key of step 4)
   * 6. Do the REST call to get all contacts with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the contacts of the patient.
   * @deprecated use {@link findIdsBy} instead.
   * @param hcpartyId
   * @param patient
   * @param usingPost (Promise)
   */
  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    let forms: Array<models.Form> = await (usingPost
      ? this.findFormsByHCPartyPatientForeignKeysUsingPost(hcpartyId!, undefined, undefined, undefined, _.uniq(extractedKeys))
      : this.findFormsByHCPartyPatientForeignKeys(hcpartyId!, _.uniq(extractedKeys).join(',')))
    return await this.decrypt(hcpartyId, forms)
  }

  /**
   * Same as {@link findBy} but it will only return the ids of the forms. It can also filter the forms where Form.openingDate is between
   * startDate and endDate in ascending or descending order by that field. (default: ascending).
   */
  async findIdsBy(hcpartyId: string, patient: models.Patient, startDate?: number, endDate?: number, descending?: boolean) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    return this.findFormIdsByDataOwnerPatientOpeningDate(hcpartyId, _.uniq(extractedKeys), startDate, endDate, descending)
  }

  decrypt(hcpartyId: string, forms: Array<models.Form>) {
    return Promise.all(
      forms.map((form) =>
        this.crypto.xapi.decryptEntity(form, EntityWithDelegationTypeName.Form, (x) => new models.Form(x)).then(({ entity }) => entity)
      )
    )
  }

  /**
   * @param form a form
   * @return the id of the patient that the form refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(form: models.Form): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: form, type: EntityWithDelegationTypeName.Form }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given form
   */
  async hasWriteAccess(form: models.Form): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: form, type: EntityWithDelegationTypeName.Form })
  }

  /**
   * Share an existing form with other data owners, allowing them to access the non-encrypted data of the form and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the form.
   * @param form the form to share.
   * @param options optional parameters to customize the sharing behaviour:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * form does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this form refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWith(
    delegateId: string,
    form: models.Form,
    options: {
      shareSecretIds?: string[]
      requestedPermissions?: RequestedPermissionEnum
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    } = {}
  ): Promise<models.Form> {
    return this.shareWithMany(form, { [delegateId]: options })
  }

  /**
   * Share an existing form with other data owners, allowing them to access the non-encrypted data of the form and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param form the form to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * form does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this form refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return the updated entity
   */
  async shareWithMany(
    form: models.Form,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<models.Form> {
    return (await this.tryShareWithMany(form, delegates)).updatedEntityOrThrow
  }

  /**
   * Share an existing form with other data owners, allowing them to access the non-encrypted data of the form and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param form the form to share.
   * @param delegates associates the id of data owners which will be granted access to the entity, to the following sharing options:
   * - shareSecretIds: specifies which secret ids of the entity should be shared. If not provided all secret ids available to the current user will be shared
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * form does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this form refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * - requestedPermissions: the requested permissions for the delegate, defaults to {@link RequestedPermissionEnum.MAX_WRITE}.
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async tryShareWithMany(
    form: models.Form,
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: string[]
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareResult<models.Form>> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(form, EntityWithDelegationTypeName.Form)
    const updatedEntity = entityWithEncryptionKey ? await this.modifyForm(entityWithEncryptionKey) : form
    return this.crypto.xapi
      .simpleShareOrUpdateEncryptedEntityMetadata(
        {
          entity: updatedEntity,
          type: EntityWithDelegationTypeName.Form,
        },
        Object.fromEntries(
          Object.entries(delegates).map(([delegateId, options]) => [
            delegateId,
            {
              requestedPermissions: options.requestedPermissions,
              shareEncryptionKeys: options.shareEncryptionKey,
              shareOwningEntityIds: options.sharePatientId,
              shareSecretIds: options.shareSecretIds,
            },
          ])
        ),
        (x) => this.bulkShareForms(x)
      )
      .then((r) => r.mapSuccessAsync((e) => this.decrypt(self, [e]).then((es) => es[0])))
  }

  getDataOwnersWithAccessTo(
    entity: models.Form
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Form })
  }

  getEncryptionKeysOf(entity: models.Form): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Form }, undefined)
  }

  createDelegationDeAnonymizationMetadata(entity: models.Form, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Form }, delegates)
  }
}
