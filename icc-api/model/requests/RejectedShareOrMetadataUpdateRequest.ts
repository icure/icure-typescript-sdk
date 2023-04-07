/**
 * Represents a reason why a share requests failed or was rejected.
 */
export class RejectedShareOrMetadataUpdateRequest {
  constructor(json: JSON | any) {
    Object.assign(this as RejectedShareOrMetadataUpdateRequest, json)
    this.shouldRetry = !!json['shouldRetry']
  }

  /**
   * Code of the error, mimics an http status code (400 general user error, 409 conflict, ...).
   */
  code?: number
  /**
   * If true a new share request with the same content may succeed so the user is encouraged to retry. This could
   * happen if the entity to share changed while verifying the validity of the request (correctness, permissions,
   * ...), and if the entity did not change in ways incompatible with the request re-performing the request in
   * the same way may succeed.
   */
  shouldRetry: boolean
  /**
   * Human-friendly message explaining the reason of the failure.
   */
  reason?: string
}
