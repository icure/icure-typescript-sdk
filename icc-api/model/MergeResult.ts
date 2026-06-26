/**
 * iCure Data Stack API Documentation
 *
 * Result of the automatic resolution of the conflicting revisions of a single entity.
 */
export class MergeResult {
  /**
   * @param json the raw json returned by the backend.
   */
  constructor(json?: JSON | any) {
    if (json) Object.assign(this as MergeResult, json)
  }

  /**
   * The outcome of the resolution for the entity.
   * - `Success`: all the conflicting revisions were merged/resolved into a single one.
   * - `PartialSuccess`: some of the conflicting revisions were resolved but others are still in conflict.
   * - `Failure`: the conflicting revisions could not be resolved.
   */
  type?: MergeResult.TypeEnum
  /**
   * The id of the entity the resolution was attempted on.
   */
  id?: string
  /**
   * The revision of the resolved entity. Set for `Success` and `PartialSuccess`, absent for `Failure`.
   */
  rev?: string
}

export namespace MergeResult {
  export enum TypeEnum {
    Success = 'Success',
    PartialSuccess = 'PartialSuccess',
    Failure = 'Failure',
  }
}
