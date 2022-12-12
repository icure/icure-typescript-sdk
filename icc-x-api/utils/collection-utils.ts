/**
 * Check if two sets are equals (they contain the same elements). Will not work if the content can't be compared by `==`.
 */
export function setEquals<T>(setA: Set<T>, setB: Set<T>): boolean {
  if (setA.size != setB.size) return false
  return Array.from(setA).every((x) => setB.has(x))
}

/**
 * Check if two arrays are equals (they contain the same elements). Will not work if the content can't be compared by `==`.
 */
export function arrayEquals<T>(arrayA: T[], arrayB: T[]): boolean {
  if (arrayA.length != arrayB.length) return false
  for (let i = 0; i < arrayA.length; ++i) {
    if (arrayA[i] !== arrayB[i]) return false
  }
  return true
}
