export class SecurePermission {
  constructor(json: JSON | any) {
    Object.assign(this as SecurePermission, json)
  }

  /**
   * Unique human-friendly identifier of the permission. Each permission has a different identifier.
   */
  id?: string

  /**
   * Unique index of the permission used when representing the permissions of a user as a bit vector.
   * In case this version of kraken is unaware of the index associated to the permission with this [id] (e.g. if the
   * permission is introduced by a more recent version of kraken and was added to existing roles) this value will be
   * `null`.
   */
  index?: number

  /**
   * Some permissions are considered highly sensitive and instead of trusting the jwt (which may have some permissions
   * that the user has not anymore since the last time the jwt was refreshed) any method requiring a permission with
   * mustBeSecure set to true will check for the state of the user in the database.
   */
  mustBeSecure?: boolean
}
