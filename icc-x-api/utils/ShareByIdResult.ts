import { EntityShareRequest } from '../../icc-api/model/requests/EntityShareRequest'
import { ShareMetadataBehaviour } from '../crypto/ShareMetadataBehaviour'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

/**
 * What a single share-or-metadata-update request the SDK sent was actually for. Sharing an entity may require the SDK
 * to also migrate the pre-existing legacy delegations of the data owners of the current hierarchy to the current
 * secure-delegation format, and those migrations travel as requests of their own - sometimes merged with a request
 * the caller asked for.
 */
export enum ShareRequestPurpose {
  /**
   * The request was only about the sharing the caller asked for.
   */
  RequestedShare = 'RequestedShare',
  /**
   * The request was only about migrating the legacy delegations of a data owner of the current hierarchy: the caller
   * did not ask to share with that data owner at all. The outcome of such a request says nothing about the sharing
   * the caller did ask for.
   */
  Migration = 'Migration',
  /**
   * The request did both: the caller asked to share with a data owner whose legacy delegations also needed to be
   * migrated, and the SDK merged the two into a single request. The requested sharing was NOT left out of it, so for
   * everything that concerns the caller this behaves exactly like a {@link RequestedShare}.
   */
  RequestedShareAndMigration = 'RequestedShareAndMigration',
}

/**
 * Outcome of a "share by ids" bulk operation: sharing many already-existing entities (retrieved from the cloud by id)
 * with one or more delegates, using the same share options for the whole batch.
 *
 * For every entity id that was found (i.e. not in {@link notFoundIds}) and every delegate the operation was called
 * with, that (entity id, delegate id) pair is accounted for in exactly one place: as a successful request under that
 * entity id in {@link successfulRequestsByEntityId}, as a delegate id under that entity id in
 * {@link unmodifiedDelegateIdsByEntityId}, or as an entry in {@link shareErrors} - never in more than one of these,
 * and never in none of them.
 */
export class ShareByIdResult {
  constructor(
    /**
     * Ids passed to the operation that did not correspond to any entity the current user could read (the id doesn't
     * exist, belongs to an entity of a different type, or the current user has no read access to it). These ids never
     * appear in any of the other fields below.
     */
    readonly notFoundIds: string[],
    /**
     * For each entity id, the requests that were actually sent for that entity and succeeded, one per delegate. An
     * entity id with no successful request to report is simply absent from this object - it never appears with an
     * empty array.
     *
     * In addition to the requested delegates this may contain requests for delegates that were not requested at all,
     * recognisable by a {@link ShareRequestPurpose.Migration} purpose: see {@link shareErrors} for what those are.
     */
    readonly successfulRequestsByEntityId: { [entityId: string]: SuccessfulRequestDetails[] },
    /**
     * For each entity id, the ids of the delegates for which no update request had to be sent at all, because that
     * delegate already had access to everything requested with a sufficient access level. This is tracked per
     * delegate, not per entity: if an entity was shared with two delegates and only one of them already had
     * everything, only that delegate's id ends up here - the other one ends up under
     * {@link successfulRequestsByEntityId} or in {@link shareErrors} instead. An entity id with no unmodified
     * delegate to report is simply absent from this object - it never appears with an empty array.
     */
    readonly unmodifiedDelegateIdsByEntityId: { [entityId: string]: string[] },
    /**
     * Details on the (entity, delegate) pairs for which the share request failed - see the two members of
     * {@link FailedRequestDetails} for the distinction between a failure to resolve the requested share options and a
     * request rejected by the cloud.
     *
     * In addition to the requested delegates this may contain entries for delegates that were not requested at all:
     * those are the internal requests the SDK piggybacks on a share to migrate the legacy delegations of the current
     * data owner hierarchy, and they carry a {@link ShareRequestPurpose.Migration} purpose. A failure of such a
     * request means the migration didn't happen, not that the requested sharing didn't (the requested sharing of a
     * delegate that was not requested was, by definition, not requested).
     *
     * When a requested delegate is also a data owner whose legacy delegations need to be migrated the two are done
     * by a single request, whose purpose is {@link ShareRequestPurpose.RequestedShareAndMigration}: a failure of
     * that one does mean the requested sharing failed.
     */
    readonly shareErrors: FailedRequestDetails[]
  ) {}
}

/**
 * Details about a single (entity, delegate) share-or-metadata-update request that was sent and succeeded, returned as
 * part of the success list of a bulk share operation (e.g. {@link ShareByIdResult.successfulRequestsByEntityId}).
 */
export class SuccessfulRequestDetails {
  /**
   * @param delegateId the delegate this request shared with, or updated the delegation of.
   * @param purpose what this request was for. Most callers can ignore this field: it is
   * {@link ShareRequestPurpose.RequestedShare} for a plain share, and the two other values only tell you that the SDK
   * also had (or only had) to migrate the legacy delegations of that data owner along the way.
   */
  constructor(readonly delegateId: string, readonly purpose: ShareRequestPurpose) {}
}

/**
 * Whether the secret ids carried by a share request were chosen by the caller or by the SDK.
 */
export enum SharedSecretIdsSource {
  /**
   * The caller let the SDK share all the secret ids of the entity it could access
   * (see {@link SecretIdShareOptions.AllAvailable}).
   */
  AllAvailable = 'AllAvailable',
  /**
   * The caller provided the exact secret ids to share (see {@link SecretIdShareOptions.UseExactly}).
   */
  ExplicitValues = 'ExplicitValues',
}

/**
 * A non-sensitive summary of a share request: what was asked for each kind of metadata and how much of it the request
 * was carrying, but never the metadata itself - sharing a secret id or an encryption key means putting the actual
 * value in the request, and those values must not end up in an error object that callers routinely log.
 *
 * The counts are those of the resolved request: the SDK may still have dropped from it values that the delegate can
 * already access anyway.
 */
export type ShareRequestSummary = {
  /**
   * The permissions that were requested for the delegate.
   */
  readonly requestedPermissions: RequestedPermissionEnum
  /**
   * Where the secret ids of the request came from, and how many of them it was carrying.
   */
  readonly secretIds: { readonly source: SharedSecretIdsSource; readonly count: number }
  /**
   * The behaviour that was requested for the encryption keys, and how many of them the request was carrying.
   */
  readonly encryptionKeys: { readonly behaviour: ShareMetadataBehaviour; readonly count: number }
  /**
   * The behaviour that was requested for the owning entity ids, and how many of them the request was carrying.
   */
  readonly owningEntityIds: { readonly behaviour: ShareMetadataBehaviour; readonly count: number }
}

/**
 * Details about a single (entity, delegate) share-or-metadata-update request that did not succeed, returned as part
 * of the error list of a bulk share operation (e.g. {@link ShareByIdResult.shareErrors}).
 *
 * A request can fail for two very different reasons, modeled as the two members of this union: narrow to the one you
 * have - by checking {@link FailedRequestDetails.ResolutionFailed.failureType} or with `instanceof` - before doing
 * anything more specific than reading `entityId`, `delegateId` or `reason`.
 */
export type FailedRequestDetails = FailedRequestDetails.ResolutionFailed | FailedRequestDetails.RequestRejected

export namespace FailedRequestDetails {
  /**
   * The requested share options for this (entity, delegate) pair could not be satisfied with what the current data
   * owner can actually access - for example {@link ShareMetadataBehaviour.REQUIRED} was specified for some piece of
   * metadata (an encryption key, an owning entity id) that the current data owner has no access to.
   *
   * This is entirely a client-side outcome, decided from what the current data owner can access, before any request
   * is even built, let alone sent to the cloud. A retry with the same input will keep failing, unless in the meantime
   * the entity changed or someone shared the missing metadata with the current data owner.
   */
  export class ResolutionFailed {
    readonly failureType: FailedRequestDetailsFailureType.ResolutionFailed = FailedRequestDetailsFailureType.ResolutionFailed

    /**
     * @param entityId the id of the entity this request was for.
     * @param delegateId the delegate this request was trying to share with, or update the delegation of.
     * @param reason a human-friendly reason for the failure. This reason is only used to help debugging, and should
     * not be relied on for error handling. MAY CHANGE BETWEEN PATCHES.
     */
    constructor(readonly entityId: string, readonly delegateId: string, readonly reason: string) {}
  }

  /**
   * A well-formed share-or-update request was sent to the cloud for this (entity, delegate) pair and was rejected -
   * for example because the current data owner doesn't have enough permission to grant the requested access level, or
   * because the revision of the entity was stale.
   *
   * This should be uncommon if the current data owner could retrieve the entity in the first place.
   */
  export class RequestRejected {
    readonly failureType: FailedRequestDetailsFailureType.RequestRejected = FailedRequestDetailsFailureType.RequestRejected

    /**
     * @param entityId the id of the entity this request was for.
     * @param delegateId the delegate this request was trying to share with, or update the delegation of.
     * @param reason a human-friendly reason for the failure, as provided by the cloud. This reason is only used to
     * help debugging, and should not be relied on for error handling. MAY CHANGE BETWEEN PATCHES.
     * @param code the status code the cloud returned for this specific request, mimics an http status code (400
     * general user error, 409 conflict, ...).
     * @param shouldRetry whether the SDK considers this specific failure worth retrying (e.g. with a freshly
     * retrieved revision of the entity). Bulk operations already do this automatically once before giving up, so by
     * the time you observe this you can assume that retry already happened.
     * @param purpose what the rejected request was for. Most callers can ignore this field: it is
     * {@link ShareRequestPurpose.RequestedShare} for a plain share, and the two other values only tell you that the
     * SDK also had (or only had) to migrate the legacy delegations of that data owner along the way.
     * @param requestSummary a summary of what the rejected request was asking for, to help understand why it was
     * rejected. Undefined exactly when the request was not asking for anything on behalf of the caller, i.e. when
     * {@link purpose} is {@link ShareRequestPurpose.Migration}.
     */
    constructor(
      readonly entityId: string,
      readonly delegateId: string,
      readonly reason: string,
      readonly code: number | undefined,
      readonly shouldRetry: boolean,
      readonly purpose: ShareRequestPurpose,
      readonly requestSummary: ShareRequestSummary | undefined
    ) {}
  }
}

/**
 * Discriminant of the {@link FailedRequestDetails} union.
 */
export enum FailedRequestDetailsFailureType {
  /**
   * The failure is a {@link FailedRequestDetails.ResolutionFailed}.
   */
  ResolutionFailed = 'ResolutionFailed',
  /**
   * The failure is a {@link FailedRequestDetails.RequestRejected}.
   */
  RequestRejected = 'RequestRejected',
}
