/**
 * Merges arrays part of a map at specific keys.
 * Takes all arrays matching the provided keys and concatenates them into a single array. If a key does not correspond to any array it will simply
 * be ignored.
 * @param map a map of arrays
 * @param keys keys that may be in the map
 * @return the merged array
 */
export function mergeMapArrays<V>(
  map: { [key: string] : V[] },
  keys: string[]
): V[] {
  return keys.reduce<V[]>(
    (acc, key) => {
      const curr = map[key]
      if (curr && curr.length) {
        return acc.concat(curr)
      } else {
        return acc
      }
    },
    [] as V[]
  )
}

export function setEquals<T>(setA: Set<T>, setB: Set<T>): boolean {
  if (setA.size != setB.size) return false
  return Array.from(setA).every((x) => setB.has(x))
}
