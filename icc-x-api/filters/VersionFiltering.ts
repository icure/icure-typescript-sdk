/**
 * Options for filtering versioned entities, like services or health elements.
 */
export enum VersionFiltering {
  /**
   * The filter will return a matching entity only if it is the latest version.
   */
  LATEST = 'LATEST',

  /**
   * The filter will return the matching entity even if it is not the latest version.
   * The filter may return multiple versions of the same entity if they all match the filter criteria.
   */
  ANY = 'ANY',
}
