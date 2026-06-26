/**
 * Describes the strategy that should be used when automatically resolving the conflicting revisions of an entity.
 */
export enum ConflictResolutionStrategy {
  /**
   * Attempts to merge all the conflicting revisions of an entity into a single one. Revisions that cannot be merged
   * with the others are left untouched. This is the default strategy.
   */
  FullMergeability = 'FullMergeability',
  /**
   * Does not attempt any merge: it keeps the most recent revision (the one with the greatest revision ordinal) and
   * purges all the others. If multiple revisions share the greatest ordinal, the one that comes first lexicographically is chosen.
   * WARNING: the fact that one revision is greater than another is not a guaranteed that is the latest one, or even the correct one. Using this
   * strategy may lead to unexpected loss of data.
   */
  LatestRevision = 'LatestRevision',
}
