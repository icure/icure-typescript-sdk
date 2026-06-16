/**
 * iCure Data Stack API Documentation
 *
 * Body of a request to resolve conflicting revisions of a stored entity. It carries the revision that should
 * become the winner together with the revisions that should be purged.
 */
export class ConflictResolutionRequest<E> {
  constructor(json?: JSON | any) {
    if (json) Object.assign(this as ConflictResolutionRequest<E>, json)
  }

  /**
   * The revision of the entity that should be kept as the winner of the conflict.
   */
  document?: E
  /**
   * The (`_rev`) revisions of the conflicting entities that should be purged once the winner is saved.
   * When empty only the winner is saved and the other conflicting revisions are left untouched.
   */
  conflictsToPurge?: Array<string>
}
