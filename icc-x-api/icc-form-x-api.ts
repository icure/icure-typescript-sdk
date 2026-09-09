import { IccFormApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as models from '../icc-api/model/models'

import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './crypto/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { ShareByIdResult } from './utils/ShareByIdResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum
import { XHR } from '../icc-api/api/XHR'
import { EncryptedEntityXApi } from './basexapi/EncryptedEntityXApi'
import { EntityWithDelegationTypeName, parseEncryptedFields } from './utils'
import { SecretIdUseOption } from './crypto/SecretIdUseOption'
import { cloneDeep } from './utils/collection-utils'
import { SecretIdShareOptions } from './crypto/ShareSecretIdOptions'

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
   * - sfkOption: specifies which sfk of the owning entity to use.
   * - ignoreAutoDelegations: if true the data won't be shared with the autodelegations of the user, but only with additional delegates
   * - alternateRootDelegation: by default a new entity is created with a root delegation from self to self. In keyless mode this is not possible,
   * and instead the root delegation will be from self to another. You have to specify which delegate will be part of the root delegation.
   * @return a new instance of form.
   */
  async newInstance(
    user: models.User,
    patient: models.Patient,
    c: any = {},
    options: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      sfkOption?: SecretIdUseOption
      ignoreAutoDelegations?: boolean
      alternateRootDelegation?: string
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
    const sfk = await this.crypto.xapi.resolveSecretIdUseOptions(
      { entity: patient, type: EntityWithDelegationTypeName.Patient },
      options.sfkOption ?? SecretIdUseOption.UseAnySharedWithParent
    )
    const extraDelegations = {
      ...(options.ignoreAutoDelegations == true
        ? {}
        : Object.fromEntries(
            [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
          )),
      ...(options?.additionalDelegates ?? {}),
    }
    return new models.Form(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(
          form,
          EntityWithDelegationTypeName.Form,
          patient.id,
          sfk,
          true,
          extraDelegations,
          options.alternateRootDelegation
        )
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
   * 6. Do the REST call to get all forms with (allSecretForeignKeysDelimitedByComa, hcpartyId)
   *
   * After these painful steps, you have the forms of the patient.
   * @deprecated use {@link findIdsBy} instead.
   * @param hcpartyId
   * @param patient
   * @param usingPost (Promise)
   */
  async findBy(hcpartyId: string, patient: models.Patient, usingPost: boolean = false) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    const topmostParentId = (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds())[0]
    let forms: Array<models.Form> = await (usingPost
      ? this.findFormsByHCPartyPatientForeignKeysUsingPost(hcpartyId!, undefined, undefined, undefined, [...new Set(extractedKeys)])
      : this.findFormsByHCPartyPatientForeignKeys(hcpartyId!, [...new Set(extractedKeys)].join(',')))
    return await this.decrypt(hcpartyId, forms)
  }

  /**
   * Same as {@link findBy} but it will only return the ids of the forms. It can also filter the forms by opening date
   * (the date when the form was opened/started) between startDate and endDate in ascending or descending order by that field (default: ascending).
   * @param hcpartyId the id of the data owner.
   * @param patient the patient whose forms to retrieve.
   * @param startDate optional start date filter (inclusive). Only forms with openingDate >= startDate will be returned.
   * @param endDate optional end date filter (inclusive). Only forms with openingDate <= endDate will be returned.
   * @param descending if true, results are sorted by openingDate in descending order; otherwise in ascending order (default).
   * @return an array of form ids.
   */
  async findIdsBy(hcpartyId: string, patient: models.Patient, startDate?: number, endDate?: number, descending?: boolean) {
    const extractedKeys = await this.crypto.xapi.secretIdsOf({ entity: patient, type: EntityWithDelegationTypeName.Patient }, hcpartyId)
    return this.findFormIdsByDataOwnerPatientOpeningDate(hcpartyId, [...new Set(extractedKeys)], startDate, endDate, descending)
  }

  /**
   * Decrypts the encrypted content of the provided forms.
   * @param hcpartyId the id of the data owner attempting to decrypt the forms.
   * @param forms the forms to decrypt.
   * @return an array of decrypted forms. Forms that could not be decrypted will be returned as-is.
   */
  async decrypt(hcpartyId: string, forms: Array<models.Form>) {
    return (await this.crypto.xapi.tryDecryptEntities(forms, EntityWithDelegationTypeName.Form, (x) => new models.Form(x))).map(
      ({ entity }) => entity
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

  /**
   * Shares the forms with the provided ids with one or more delegates, using the same share options for all of
   * them.
   *
   * Unlike {@link shareWith} this method does not need the decrypted forms, does not return them, and does not
   * fail because of a single form or delegate: the outcome of each (form, delegate) pair is reported in
   * the returned {@link ShareByIdResult}. Ids of forms that don't exist or that the current user can't read are
   * reported in {@link ShareByIdResult.notFoundIds} and are otherwise ignored.
   * @param ids the ids of the forms to share. Duplicates are ignored.
   * @param delegates associates the id of the data owners which will be granted access to the forms to the
   * following sharing options:
   * - shareSecretIds specifies which secret ids of each of the forms should be shared: with
   * {@link SecretIdShareOptions.AllAvailable} (the default) each of them is shared with all the secret ids of that entity
   * that the current data owner can access, with {@link SecretIdShareOptions.UseExactly} they are all shared with exactly
   * the provided secret ids.
   * - requestedPermissions requested permissions for the delegate. Defaults to
   * {@link RequestedPermissionEnum.MAX_WRITE}.
   * - shareEncryptionKey specifies if the encryption key of the forms should be shared: this is needed for the
   * delegate to be able to decrypt their content. Defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * - sharePatientId specifies if the id of the patient the forms refer to should be shared with the delegate. Defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}.
   * @return a promise which will be completed with the outcome of the operation for each (form, delegate) pair.
   */
  async shareById(
    ids: string[],
    delegates: {
      [delegateId: string]: {
        shareSecretIds?: SecretIdShareOptions // Defaults to all available without being required
        requestedPermissions?: RequestedPermissionEnum
        shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
        sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      }
    }
  ): Promise<ShareByIdResult> {
    return this.crypto.xapi.shareById(
      ids,
      Object.fromEntries(
        Object.entries(delegates).map(([delegateId, options]) => [
          delegateId,
          {
            shareSecretIds: options.shareSecretIds,
            requestedPermissions: options.requestedPermissions,
            shareEncryptionKeys: options.shareEncryptionKey,
            shareOwningEntityIds: options.sharePatientId,
          },
        ])
      ),
      EntityWithDelegationTypeName.Form,
      (x) => this.findFormsDelegationsStubsByIds(x),
      (x) => this.bulkShareFormsMinimal(x)
    )
  }

  /**
   * Gets all data owners that have access to the given form, along with their access levels.
   * @param entity the form to check.
   * @return an object containing:
   * - permissionsByDataOwnerId: a map of data owner id to their access level.
   * - hasUnknownAnonymousDataOwners: true if there are anonymous data owners with access that could not be identified.
   */
  getDataOwnersWithAccessTo(
    entity: models.Form
  ): Promise<{ permissionsByDataOwnerId: { [p: string]: AccessLevelEnum }; hasUnknownAnonymousDataOwners: boolean }> {
    return this.crypto.delegationsDeAnonymization.getDataOwnersWithAccessTo({ entity, type: EntityWithDelegationTypeName.Form })
  }

  /**
   * Retrieves all encryption keys of the given form that are available to the current data owner.
   * @param entity the form whose encryption keys to retrieve.
   * @return an array of encryption keys in hexadecimal string format.
   */
  getEncryptionKeysOf(entity: models.Form): Promise<string[]> {
    return this.crypto.xapi.encryptionKeysOf({ entity, type: EntityWithDelegationTypeName.Form }, undefined)
  }

  /**
   * Creates or updates de-anonymization metadata for the given form, allowing the delegates to be identified
   * even if they were initially anonymous (e.g., in keyless mode).
   * @param entity the form for which to create de-anonymization metadata.
   * @param delegates the ids of the data owners for which to create de-anonymization information.
   */
  createDelegationDeAnonymizationMetadata(entity: models.Form, delegates: string[]): Promise<void> {
    return this.crypto.delegationsDeAnonymization.createOrUpdateDeAnonymizationInfo({ entity, type: EntityWithDelegationTypeName.Form }, delegates)
  }

  /**
   * Like {@link getConflictsForEntity} but additionally decrypts the conflicting revisions for the given user.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param entityId the id of the form to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the form.
   */
  getConflictsForEntityWithUser(user: models.User, entityId: string): Promise<Array<models.Form>> {
    return super.getConflictsForEntity(entityId).then((fs) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), fs))
  }

  /**
   * Like {@link declareConflictWinner} but encrypts the winning revision before sending it and decrypts the saved
   * winner returned by the backend.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerWithUser(
    user: models.User,
    request: models.ConflictResolutionRequest<models.Form>
  ): Promise<models.ConflictResolutionResult<models.Form>> {
    const encrypted = (
      await this.crypto.xapi.tryEncryptEntities(
        [cloneDeep(request.document!)],
        EntityWithDelegationTypeName.Form,
        parseEncryptedFields([], 'Form.'),
        false,
        false,
        (x) => new models.Form(x)
      )
    )[0]
    const result = await super.declareConflictWinner({ ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), [result.document]))[0]
    return result
  }

  /**
   * Like {@link getConflictsForEntityWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will decrypt the entities.
   * @param groupId the id of the group the form belongs to.
   * @param entityId the id of the form to retrieve the conflicts for.
   * @return the decrypted conflicting revisions of the form.
   */
  getConflictsForEntityInGroupWithUser(user: models.User, groupId: string, entityId: string): Promise<Array<models.Form>> {
    return super.getConflictsForEntityInGroup(groupId, entityId).then((fs) => this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), fs))
  }

  /**
   * Like {@link declareConflictWinnerWithUser} but targets the entity of the group with the given id.
   * @param user the current user, used to determine the data owner that will encrypt/decrypt the entity.
   * @param groupId the id of the group the form belongs to.
   * @param request the {@link models.ConflictResolutionRequest} carrying the (decrypted) winning revision and the conflicts to purge.
   * @return the {@link models.ConflictResolutionResult} with the decrypted saved winner and the conflicts that are still unresolved.
   */
  async declareConflictWinnerInGroupWithUser(
    user: models.User,
    groupId: string,
    request: models.ConflictResolutionRequest<models.Form>
  ): Promise<models.ConflictResolutionResult<models.Form>> {
    const encrypted = (
      await this.crypto.xapi.tryEncryptEntities(
        [cloneDeep(request.document!)],
        EntityWithDelegationTypeName.Form,
        parseEncryptedFields([], 'Form.'),
        false,
        false,
        (x) => new models.Form(x)
      )
    )[0]
    const result = await super.declareConflictWinnerInGroup(groupId, { ...request, document: encrypted })
    if (result.document) result.document = (await this.decrypt(this.dataOwnerApi.getDataOwnerIdOf(user), [result.document]))[0]
    return result
  }
}
