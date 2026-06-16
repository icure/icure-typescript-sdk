/**
 * iCure Data Stack API Documentation
 *
 * Result of a conflict resolution request. It contains the saved winner revision and the list of conflicting
 * revisions that could not be purged (and are therefore still in conflict).
 */
export class ConflictResolutionResult<E> {
  /**
   * @param json the raw json returned by the backend.
   * @param documentFactory optional factory used to deserialize the embedded `document` into a concrete entity
   * instance (e.g. `(x) => new Patient(x)`). When omitted the `document` is left as the raw json.
   */
  constructor(json?: JSON | any, documentFactory?: (doc: any) => E) {
    if (json) Object.assign(this as ConflictResolutionResult<E>, json)
    if (json && (json as any).document && documentFactory) this.document = documentFactory((json as any).document)
  }

  /**
   * The winning revision of the entity that was saved.
   */
  document?: E
  /**
   * The revisions that are still in conflict after the resolution (i.e. the conflicts that were not purged).
   */
  remainingConflicts?: Array<string>
}
