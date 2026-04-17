/**
 * Recursively deep clone a value. Handles primitives, arrays, plain objects, Date, RegExp, Set, Map, and typed arrays.
 * Non-cloneable values (functions, WeakMap, WeakSet, etc.) are copied by reference.
 */
export function cloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj

  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as unknown as T

  if (Array.isArray(obj)) return obj.map((item) => cloneDeep(item)) as unknown as T

  if (obj instanceof Set) {
    const result = new Set()
    obj.forEach((v) => result.add(cloneDeep(v)))
    return result as unknown as T
  }

  if (obj instanceof Map) {
    const result = new Map()
    obj.forEach((v, k) => result.set(cloneDeep(k), cloneDeep(v)))
    return result as unknown as T
  }

  if (ArrayBuffer.isView(obj)) {
    const TypedArrayCtor = obj.constructor as new (buffer: ArrayBuffer) => typeof obj
    return new TypedArrayCtor((obj as unknown as { buffer: ArrayBuffer }).buffer.slice(0)) as unknown as T
  }

  const result: any = Object.create(Object.getPrototypeOf(obj))
  for (const key of Object.keys(obj)) {
    result[key] = cloneDeep((obj as any)[key])
  }
  return result
}

/**
 * Remove duplicate elements from an array based on a key function or property name.
 */
export function uniqBy<T>(arr: T[], key: ((item: T) => unknown) | string): T[] {
  const seen = new Set()
  return arr.filter((item) => {
    const k = typeof key === 'string' ? (item as any)[key] : key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Sort an array by a key function. Returns a new sorted array (does not mutate the original).
 */
export function sortBy<T>(arr: T[], keyFn: (item: T) => string | number | boolean | null | undefined): T[] {
  return [...arr].sort((a, b) => {
    const ka = keyFn(a)
    const kb = keyFn(b)
    if (ka == null && kb == null) return 0
    if (ka == null) return -1
    if (kb == null) return 1
    if (ka < kb) return -1
    if (ka > kb) return 1
    return 0
  })
}

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

/**
 * Fully consumes an async generator and provides all results as an array.
 * @param generator an async generator.
 */
export async function asyncGeneratorToArray<T>(generator: AsyncGenerator<T, any, never>): Promise<T[]> {
  const res = []
  let latest = await generator.next()
  while (!latest.done) {
    res.push(latest.value)
    latest = await generator.next()
  }
  return res
}
