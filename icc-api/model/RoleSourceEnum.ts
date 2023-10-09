/**
 * Represent where the default roles for a certain type of user come from.
 * Default: the roles are the ones defined by iCure.
 * Inherited: the roles are defined in a supergroup of the current group.
 * Configuration: the roles are defined in the current group.
 */
export enum RoleSourceEnum {
  Default = 'DEFAULT',
  Inherited = 'INHERITED',
  Configuration = 'CONFIGURATION',
}
