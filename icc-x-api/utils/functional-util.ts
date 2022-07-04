export function also<T>(value: T, lambda: (it: T) => void) {
  lambda(value)
  return value
}

export function fold<T, R>(whereToFold: Array<T>, initial: R, operation: (acc: R, element: T) => R): R {
  let accumulator = initial
  for (let i = 0; i < whereToFold.length; i++) accumulator = operation(accumulator, whereToFold[i])
  return accumulator
}
