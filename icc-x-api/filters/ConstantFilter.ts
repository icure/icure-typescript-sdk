export class ConstantFilter<T> {
  constructor(constant: T[]) {
    this.constant = constant
  }

  desc?: string
  constant?: T[]
  $type = 'ConstantFilter'
}
