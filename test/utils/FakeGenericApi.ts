import * as _ from 'lodash'
import { CryptoPrimitives, WebCryptoPrimitives } from '../../icc-x-api/crypto/CryptoPrimitives'
import { webcrypto } from 'crypto'

export class FakeGenericApi<T extends { id?: string; rev?: string }> {
  private readonly data: Map<string, T> = new Map()
  private readonly primitives: CryptoPrimitives = new WebCryptoPrimitives(webcrypto as any)

  createObject(obj: T): T {
    if (!obj.id) throw new Error(`New object should have id`)
    if (obj.rev) throw new Error(`New object should not have rev`)
    if (this.data.get(obj.id!)) throw new Error(`Object with id ${obj.id} already exists.`)
    const withRev = _.cloneDeep(obj)
    withRev.rev = this.nextRev(withRev.rev)
    this.data.set(obj.id, withRev)
    return _.cloneDeep(withRev)
  }

  modifyObject(obj: T): T {
    if (!obj.id) throw new Error(`Modified object should have id`)
    const existing = this.data.get(obj.id!)
    if (!existing) throw new Error(`No object with id ${obj.id}`)
    if (existing.rev !== obj.rev) throw new Error(`Object with id ${obj.id} has wrong rev: ${obj.rev} but expected ${existing.rev}.`)
    const withNewRev = _.cloneDeep(obj)
    withNewRev.rev = this.nextRev(withNewRev.rev)
    this.data.set(obj.id, withNewRev)
    return _.cloneDeep(withNewRev)
  }

  getAll(): T[] {
    return [...this.data.values()].map((x) => _.cloneDeep(x))
  }

  getPaged(
    startId: string | undefined,
    limit: number
  ): {
    rows: T[]
    nextId: string | undefined
  } {
    let rows = [...this.data.values()]
    let nextId = undefined
    if (startId) {
      const startIndex = rows.findIndex((x) => x.id === startId)
      rows = rows.slice(startIndex)
    }
    if (rows.length > limit) {
      nextId = rows[limit].id
      rows = rows.slice(0, limit)
    }
    return { rows: rows.map((x) => _.cloneDeep(x)), nextId }
  }

  getById(id: string): T | undefined {
    const retrieved = this.data.get(id)
    return retrieved ? _.cloneDeep(retrieved) : undefined
  }

  private nextRev(rev: string | undefined): string {
    if (!rev) return `1-${this.primitives.randomUuid()}`
    const prevRevNumber = parseInt(rev.split('-')[0])
    return `${prevRevNumber + 1}-${this.primitives.randomUuid()}`
  }
}
