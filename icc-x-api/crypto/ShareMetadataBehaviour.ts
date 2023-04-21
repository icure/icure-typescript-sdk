/**
 * Specifies a behaviour for the sharing of encryption keys or owning entity ids in the extended apis 'share' methods.
 */
export enum ShareMetadataBehaviour {
  /**
   * The method must share the metadata with the delegate. If this is not possible, because for example the current user has no access to this kind of
   * metadata, the method will throw an error.
   */
  REQUIRED = 'REQUIRED',
  /**
   * The method must share the metadata with the delegate if available. If this is not possible, because for example the current user has no access to
   * this kind of metadata, the method will simply not share this metadata.
   */
  IF_AVAILABLE = 'IF_AVAILABLE',
  /**
   * The method must not share the metadata with the delegate, even if the current data owner can access it.
   */
  NEVER = 'NEVER',
}
