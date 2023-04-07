import { RejectedShareOrMetadataUpdateRequest } from './RejectedShareOrMetadataUpdateRequest'
import { EncryptedEntity } from '../models'

/**
 * Result of a bulk share operation.
 */
export class MinimalEntityBulkShareResult {
  constructor(json: JSON | any) {
    Object.assign(this as MinimalEntityBulkShareResult, json)
  }

  /**
   * Id of the entity for which the update was requested.
   */
  entityId!: string
  /**
   * Last known revision of the entity before any update, non-null only if an entity matching the requests could be
   * found. This can help to understand if an error is caused by an outdated version of the entity on the client-side.
   */
  entityRev?: string
  /**
   * If a `bulkShare` method fails to apply any of the share requests for an entity this map associates the id of the
   * original failed request to the reason of failure.
   */
  rejectedRequests?: { [requestId: string]: RejectedShareOrMetadataUpdateRequest }
}
