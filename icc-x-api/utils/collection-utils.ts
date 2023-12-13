/**
 * Check if two sets are equals (they contain the same elements). Will not work if the content can't be compared by `==`.
 */
export function setEquals<T>(setA: Set<T>, setB: Set<T>): boolean {
  if (setA.size != setB.size) return false
  return Array.from(setA).every((x) => setB.has(x))
}

/**
 * Check if two arrays are equals (they contain the same elements).
 */
export function arrayEquals<T>(arrayA: T[], arrayB: T[]): boolean {
  if (arrayA.length != arrayB.length) return false
  for (let i = 0; i < arrayA.length; ++i) {
    if (!anyEquals(arrayA[i], arrayB[i])) return false
  }
  return true
}

/**
 * Check if two elements are equals (they contain the same elements).
 */
export function anyEquals(anyA: any, anyB: any): boolean {
  //Test if object is array
  if (Array.isArray(anyA) && Array.isArray(anyB)) {
    return arrayEquals(anyA, anyB)
  } /*Test if objects are set */ else if (anyA instanceof Set && anyB instanceof Set) {
    return setEquals(anyA, anyB)
  } else if (typeof anyA === 'object' && typeof anyB === 'object') {
    return objectEquals(anyA, anyB)
  }
  return anyA === anyB
}

/**
 * Check if two objects are equals (by comparing the properties in a deep way).
 * @param objectA
 * @param objectB
 * @param ignoredProperties
 */
export function objectEquals<T extends { [key: string]: any }>(objectA: T, objectB: T, ignoredProperties?: string[]): boolean {
  const missingInA = Object.keys(objectB)
    .filter((key) => !ignoredProperties?.includes(key))
    .filter((key) => !Object.keys(objectA).includes(key))
    .filter((key) => objectB[key] !== undefined && objectB[key] !== null)

  if (missingInA.length > 0) return false

  const missingInB = Object.keys(objectA)
    .filter((key) => !ignoredProperties?.includes(key))
    .filter((key) => !Object.keys(objectB).includes(key))
    .filter((key) => objectA[key] !== undefined && objectA[key] !== null)

  if (missingInB.length > 0) return false

  for (let i = 0, keys = Object.keys(objectA); i < keys.length; i++) {
    const key = keys[i]
    if (ignoredProperties?.includes(key)) continue
    if (!anyEquals(objectA[key], objectB[key])) return false
  }

  return true
}
