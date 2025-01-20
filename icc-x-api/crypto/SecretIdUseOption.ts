export type SecretIdUseOption =
  | typeof SecretIdUseOption.UseAnyConfidential
  | typeof SecretIdUseOption.UseAllConfidential
  | typeof SecretIdUseOption.UseAnySharedWithParent
  | typeof SecretIdUseOption.UseAllSharedWithParent
  | typeof SecretIdUseOption.UseNone
  | SecretIdUseOption.Use

/**
 * Configuration for which secret id to use for linking to a owning entity (e.g. which secret id of patient to use
 * when linking a contact to the patient)
 */
export namespace SecretIdUseOption {
  /**
   * This will use any one secret id that is not known by any parent hcp of the current data owner.
   * If the api is initialized in a mode where the parent hcp keys are unused, this means "use any one available
   * secret id".
   * Guarantees that a secret id is used: if no secret id is found, the initialization method will fail.
   */
  export const UseAnyConfidential: { readonly kind: 'SecretIdUseOption.UseAnyConfidential' } = { kind: 'SecretIdUseOption.UseAnyConfidential' }

  /**
   * This will use all secret ids that aren't known by any parent hcp of the current data owner.
   * If the api is initialized in a mode where the parent hcp keys are unused, this means "use all available secret
   * id".
   * Guarantees that a secret id is used: if no secret id is found, the initialization method will fail.
   */
  export const UseAllConfidential: { readonly kind: 'SecretIdUseOption.UseAllConfidential' } = { kind: 'SecretIdUseOption.UseAllConfidential' }

  /**
   * This will use one secret id that is known by the topmost ancestor in the current data owner hierarchy.
   * If the api is initialized in a mode where the parent hcp keys are unused, this means "use any one available
   * secret id".
   * Guarantees that a secret id is used: if no secret id is found, the initialization method will fail.
   */
  export const UseAnySharedWithParent: { readonly kind: 'SecretIdUseOption.UseAnySharedWithParent' } = {
    kind: 'SecretIdUseOption.UseAnySharedWithParent',
  }

  /**
   * This will use all secret id that is known by the topmost ancestor in the current data owner hierarchy.
   * If the api is initialized in a mode where the parent hcp keys are unused, this means "use all available secret
   * id".
   * Guarantees that a secret id is used: if no secret id is found, the initialization method will fail.
   */
  export const UseAllSharedWithParent: { readonly kind: 'SecretIdUseOption.UseAllSharedWithParent' } = {
    kind: 'SecretIdUseOption.UseAllSharedWithParent',
  }

  /**
   * Specify explicitly which secret ids to use. The secretIds can also be empty, in which case the value is
   * equivalent to [UseNone].
   * Note that the SDK will not check that the secret id you used is actually a secret id of the owning entity.
   */
  export class Use {
    constructor(public readonly secretIds: string[]) {}
  }

  /**
   * Instructs the SDK to use no secret id of the owning entity.
   * The new entity will still have a link to the owning entity, but there will be no link from the owning entity to
   * the new entity.
   */
  export const UseNone: { readonly kind: 'SecretIdUseOption.UseNone' } = { kind: 'SecretIdUseOption.UseNone' }
}
