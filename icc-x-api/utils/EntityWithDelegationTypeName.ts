/**
 * Names of all possible encrypted entity types.
 */
import { EncryptedEntity, EncryptedEntityStub } from '../../icc-api/model/models'

export const entityWithDelegationTypeNames: Set<EntityWithDelegationTypeName> = new Set([
  'Article',
  'AccessLog',
  'CalendarItem',
  'Classification',
  'Contact',
  'Document',
  'Form',
  'HealthElement',
  'Invoice',
  'MaintenanceTask',
  'Message',
  'Patient',
  'Receipt',
  'TimeTable',
])

export type EntityWithDelegationTypeName =
  | 'Article'
  | 'AccessLog'
  | 'CalendarItem'
  | 'Classification'
  | 'Contact'
  | 'Document'
  | 'Form'
  | 'HealthElement'
  | 'Invoice'
  | 'MaintenanceTask'
  | 'Message'
  | 'Patient'
  | 'Receipt'
  | 'TimeTable'
/**
 * Type containing information on an entity and its type. If the entity is a stub (EncryptedEntityStub or IcureStub) the type should refer to the
 * original entity from which the stub was extracted.
 */
export type EncryptedEntityWithType = { entity: EncryptedEntityStub | EncryptedEntity; type: EntityWithDelegationTypeName }

/**
 * @internal this function is meant for internal use only and may be changed without notice
 * Gets the class of an encrypted entity. Throws error if the class can't be retrieved.
 * @param entity the entity object
 * @param declaredClassName the declared type of the entity, to use as a fallback in case the original class name can't be retrieved (for example
 * due to the use of minified code).
 * @return the class of the encrypted entity
 */
export function encryptedEntityClassOf(
  entity: EncryptedEntity | EncryptedEntityStub,
  declaredClassName: EntityWithDelegationTypeName | undefined
): EntityWithDelegationTypeName {
  const entityClass = tryGetEncryptedEntityClassOf(entity, declaredClassName)
  if (entityClass) {
    return entityClass
  } else
    throw new Error(
      `No valid encrypted entity class name (constructor: "${entity.constructor.name}",` +
        `declared: ${declaredClassName ? '"' + declaredClassName + '"' : 'undefined'}).` +
        `Please specify a valid class name.\nValid class names are ${Array.from(entityWithDelegationTypeNames)}.`
    )
}

/**
 * @internal this function is meant for internal use only and may be changed without notice
 * Gets the class of an encrypted entity. Returns undefined if the class can't be retrieved.
 * @param entity the entity object
 * @param declaredClassName the declared type of the entity, to use as a fallback in case the original class name can't be retrieved (for example
 * due to the use of minified code).
 * @return the class of the encrypted entity
 */
export function tryGetEncryptedEntityClassOf(
  entity: EncryptedEntity | EncryptedEntityStub,
  declaredClassName: EntityWithDelegationTypeName | undefined
): EntityWithDelegationTypeName | undefined {
  const _type = (entity as any)._type
  if (_type && (typeof _type === 'string' || _type instanceof String)) {
    const splitType = _type.split('.')
    const candidate = splitType[splitType.length - 1]
    if (entityWithDelegationTypeNames.has(candidate as any)) {
      if (declaredClassName && declaredClassName !== candidate)
        throw new Error(`Declared type name "${declaredClassName}" does not match type detected from field \`_type:"${_type}"\` ("${candidate}")`)
      return candidate as EntityWithDelegationTypeName
    }
  }
  if (!declaredClassName)
    console.warn(
      'Usage of a delegation-related method without specifying the entity class name, and input object does not have a `_type` value. ' +
        'Will use constructor name as fallback, but this may not work with minified code.'
    )
  const constructorName = entity.constructor?.name
  if (entityWithDelegationTypeNames.has(constructorName as any)) {
    if (declaredClassName && declaredClassName !== constructorName)
      throw new Error(`Declared type name "${declaredClassName}" does not match valid constructor name "${constructorName}"`)
    return constructorName as EntityWithDelegationTypeName
  } else if (declaredClassName && entityWithDelegationTypeNames.has(declaredClassName)) {
    return declaredClassName
  } else return undefined
}
