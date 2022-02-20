export function also<T>(value: T, lambda: (it: T) => void) {
  lambda(value)
  return value
}
