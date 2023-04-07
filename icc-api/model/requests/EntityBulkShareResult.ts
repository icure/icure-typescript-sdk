import { RejectedShareOrMetadataUpdateRequest } from './RejectedShareOrMetadataUpdateRequest'
import { EncryptedEntity } from '../models'

/**
 * Result of a bulk share operation.
 */
export class EntityBulkShareResult<T extends EncryptedEntity> {
  constructor(json: JSON | any, entityConstructor: new (json: JSON | any) => T) {
    Object.assign(this as EntityBulkShareResult<T>, json)
    if (json['updatedEntity']) {
      this.updatedEntity = new entityConstructor(json['updatedEntity'])
    }
  }

  /**
   * The updated entity. Non-null if at least one of the requests succeeded.
   */
  updatedEntity?: T
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
