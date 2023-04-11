import { IccMessageApi } from '../icc-api'
import { IccCryptoXApi } from './icc-crypto-x-api'

import * as _ from 'lodash'

import { Patient, User } from '../icc-api/model/models'
import { IccDataOwnerXApi } from './icc-data-owner-x-api'
import { AuthenticationProvider, NoAuthenticationProvider } from './auth/AuthenticationProvider'
import * as models from '../icc-api/model/models'
import { SecureDelegation } from '../icc-api/model/SecureDelegation'
import AccessLevelEnum = SecureDelegation.AccessLevelEnum
import { ShareMetadataBehaviour } from './utils/ShareMetadataBehaviour'
import { ShareResult } from './utils/ShareResult'
import { EntityShareRequest } from '../icc-api/model/requests/EntityShareRequest'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

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

  /**
   * Creates a new instance of message with initialised encryption metadata (not in the database).
   * @param user the current user.
   * @param patient the patient this message refers to.
   * @param m initialised data for the message. Metadata such as id, creation data, etc. will be automatically initialised, but you can specify
   * other kinds of data or overwrite generated metadata with this. You can't specify encryption metadata.
   * @param optionalParams optional parameters:
   * - additionalDelegates: delegates which will have access to the entity in addition to the current data owner and delegates from the
   * auto-delegations. Must be an object which associates each data owner id with the access level to give to that data owner. May overlap with
   * auto-delegations, in such case the access level specified here will be used.
   * - preferredSfk: secret id of the patient to use as the secret foreign key to use for the message. The default value will be a
   * secret id of patient known by the topmost parent in the current data owner hierarchy.
   * @return a new instance of message.
   */
  async newInstanceWithPatient(
    user: User,
    patient: Patient | null,
    m: any = {},
    optionalParams: {
      additionalDelegates?: { [dataOwnerId: string]: AccessLevelEnum }
      preferredSfk?: string
    } = {}
  ) {
    if (!patient && optionalParams.preferredSfk) throw new Error('preferredSfk can only be specified if patient is specified.')
    const message = _.extend(
      {
        id: this.crypto.primitives.randomUuid(),
        _type: 'org.taktik.icure.entities.Message',
        created: new Date().getTime(),
        modified: new Date().getTime(),
        responsible: this.dataOwnerApi.getDataOwnerIdOf(user),
        author: user.id,
        codes: [],
        tags: [],
      },
      m || {}
    )

    const ownerId = this.dataOwnerApi.getDataOwnerIdOf(user)
    if (ownerId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) throw new Error('Can only initialise entities as current data owner.')
    const sfk = patient
      ? optionalParams.preferredSfk ?? (await this.crypto.confidential.getAnySecretIdSharedWithParents({ entity: patient, type: 'Patient' }))
      : undefined
    if (patient && !sfk) throw new Error(`Couldn't find any sfk of parent patient ${patient.id}`)
    const extraDelegations = {
      ...Object.fromEntries(
        [...(user.autoDelegations?.all ?? []), ...(user.autoDelegations?.medicalInformation ?? [])].map((d) => [d, AccessLevelEnum.WRITE])
      ),
      ...(optionalParams?.additionalDelegates ?? {}),
    }
    return new models.Message(
      await this.crypto.xapi
        .entityWithInitialisedEncryptedMetadata(message, 'Message', patient?.id, sfk, true, true, extraDelegations)
        .then((x) => x.updatedEntity)
    )
  }

  /**
   * @param message a message
   * @return the id of the patient that the message refers to, retrieved from the encrypted metadata. Normally there should only be one element
   * in the returned array, but in case of entity merges there could be multiple values.
   */
  async decryptPatientIdOf(message: models.Message): Promise<string[]> {
    return this.crypto.xapi.owningEntityIdsOf({ entity: message, type: 'Message' }, undefined)
  }

  /**
   * @return if the logged data owner has write access to the content of the given message
   */
  async hasWriteAccess(message: models.Message): Promise<boolean> {
    return this.crypto.xapi.hasWriteAccess({ entity: message, type: 'Message' })
  }

  /**
   * Share an existing message with other data owners, allowing them to access the non-encrypted data of the message and optionally also
   * the encrypted content, with read-only or read-write permissions.
   * @param delegateId the id of the data owner which will be granted access to the message.
   * @param message the message to share.
   * @param requestedPermissions the requested permissions for the delegate.
   * @param shareSecretIds the secret ids of the Message that the delegate will be given access to. Allows the delegate to search for data where the
   * shared Message is the owning entity id.
   * @param optionalParams optional parameters to customize the sharing behaviour:
   * - shareEncryptionKey: specifies if the encryption key of the access log should be shared with the delegate, giving access to all encrypted
   * content of the entity, excluding other encrypted metadata (defaults to {@link ShareMetadataBehaviour.IF_AVAILABLE}). Note that by default a
   * message does not have encrypted content.
   * - sharePatientId: specifies if the id of the patient that this message refers to should be shared with the delegate (defaults to
   * {@link ShareMetadataBehaviour.IF_AVAILABLE}).
   * @return a promise which will contain the result of the operation: the updated entity if the operation was successful or details of the error if
   * the operation failed.
   */
  async shareWith(
    delegateId: string,
    message: models.Message,
    requestedPermissions: RequestedPermissionEnum,
    shareSecretIds: string[],
    optionalParams: {
      shareEncryptionKey?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
      sharePatientId?: ShareMetadataBehaviour // Defaults to ShareMetadataBehaviour.IF_AVAILABLE
    }
  ): Promise<ShareResult<models.Message>> {
    // All entities should have an encryption key.
    const entityWithEncryptionKey = await this.crypto.xapi.ensureEncryptionKeysInitialised(message, 'Message')
    const updatedEntity = entityWithEncryptionKey ? await this.modifyMessage(entityWithEncryptionKey) : message
    return this.crypto.xapi.simpleShareOrUpdateEncryptedEntityMetadata(
      { entity: updatedEntity, type: 'Message' },
      delegateId,
      optionalParams?.shareEncryptionKey,
      optionalParams?.sharePatientId,
      [],
      requestedPermissions,
      (x) => this.bulkShareMessages(x)
    )
  }

  /**
   * @param message a message
   * @return the secret ids of the message, retrieved from the encrypted metadata. The result may be used to find entities where the message is
   * the 'owning entity', or in the {@link shareWith} method in order to share it with other data owners.
   */
  getSecretIdsOf(message: models.Message): Promise<string[]> {
    return this.crypto.xapi.secretIdsOf({ entity: message, type: 'Message' }, undefined)
  }
}
