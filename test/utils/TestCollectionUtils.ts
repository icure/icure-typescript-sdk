import { expect } from 'chai'
import { arrayEquals, cloneDeep, objectEquals, setEquals } from '../../icc-x-api/utils/collection-utils'

describe('setEquals', () => {
  it('should return true for two empty sets', () => {
    expect(setEquals(new Set(), new Set())).to.be.true
  })

  it('should return true for two sets with the same elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([3, 1, 2])
    expect(setEquals(setA, setB)).to.be.true
  })

  it('should return false for sets with different elements', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([4, 5, 6])
    expect(setEquals(setA, setB)).to.be.false
  })

  it('should return false for sets of different sizes', () => {
    const setA = new Set([1, 2, 3])
    const setB = new Set([1, 2])
    expect(setEquals(setA, setB)).to.be.false
  })
})

describe('objectEquals', () => {
  it('should return true for two empty objects', () => {
    expect(objectEquals({}, {})).to.be.true
  })

  it('should return true for identical objects', () => {
    const objA = { a: 1, b: 2 }
    const objB = { a: 1, b: 2 }
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with different properties', () => {
    const objA: any = { a: 1, b: 2 }
    const objB: any = { a: 1, c: 3 }
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for objects with nested identical objects', () => {
    const objA = { a: 1, b: { c: 3, d: 4 } }
    const objB = { a: 1, b: { c: 3, d: 4 } }
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with nested different objects', () => {
    const objA = { a: 1, b: { c: 3, d: 4 } }
    const objB = { a: 1, b: { c: 3, d: 5 } }
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for objects with identical arrays', () => {
    const objA = { a: 1, b: [1, 2, 3] }
    const objB = { a: 1, b: [1, 2, 3] }
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with different arrays', () => {
    const objA = { a: 1, b: [1, 2, 3] }
    const objB = { a: 1, b: [1, 2, 4] }
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for deeply nested objects', () => {
    const objA = { a: 1, b: { c: { d: 4, e: 5 } } }
    const objB = { a: 1, b: { c: { d: 4, e: 5 } } }
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should respect ignoredProperties', () => {
    const objA: any = { a: 1, b: 2, c: 3 }
    const objB: any = { a: 1, b: 2, d: 4 }
    expect(objectEquals(objA, objB, ['c', 'd'])).to.be.true
  })
})

describe('arrayEquals', () => {
  it('should return true for two empty arrays', () => {
    expect(arrayEquals([], [])).to.be.true
  })

  it('should return true for two identical arrays of primitives', () => {
    expect(arrayEquals(['1', 2, 3], ['1', 2, 3])).to.be.true
  })

  it('should return false for two different arrays of primitives', () => {
    expect(arrayEquals(['1', 2, 3], [1, 2, 3])).to.be.false
  })

  it('should return false for arrays of different primitives', () => {
    expect(arrayEquals([1, 2, 3], [1, 2, 4])).to.be.false
  })

  it('should return true for nested arrays with the same elements', () => {
    expect(arrayEquals([1, [2, 3], 4], [1, [2, 3], 4])).to.be.true
  })

  it('should return false for nested arrays with different elements', () => {
    expect(arrayEquals([1, [2, 3], 4], [1, [2, 4], 4])).to.be.false
  })

  it('should return true for arrays with identical objects', () => {
    const objA = { a: 1, b: 2 }
    const objB = { a: 1, b: 2 }
    expect(arrayEquals([objA], [objB])).to.be.true
  })

  it('should return false for arrays with different objects', () => {
    const objA: any = { a: 1, b: 2 }
    const objB: any = { a: 1, c: 3 }
    expect(arrayEquals([objA], [objB])).to.be.false
  })

  it('should return true for arrays with deeply nested structures', () => {
    const nestedArray = [1, { a: [2, 3, { b: 4 }] }, 5]
    expect(arrayEquals(nestedArray, nestedArray)).to.be.true
  })

  it('should return false for arrays with differently nested structures', () => {
    const nestedArray1 = [1, { a: [2, 3, { b: 4 }] }, 5]
    const nestedArray2 = [1, { a: [2, 3, { b: 5 }] }, 5]
    expect(arrayEquals(nestedArray1, nestedArray2)).to.be.false
  })
})

describe('cloneDeep', () => {
  describe('primitives', () => {
    it('should return primitives unchanged', () => {
      expect(cloneDeep(42)).to.equal(42)
      expect(cloneDeep('hello')).to.equal('hello')
      expect(cloneDeep(true)).to.equal(true)
      expect(cloneDeep(null)).to.equal(null)
      expect(cloneDeep(undefined)).to.equal(undefined)
    })

    it('should preserve NaN, Infinity and -0', () => {
      expect(Number.isNaN(cloneDeep(NaN))).to.be.true
      expect(cloneDeep(Infinity)).to.equal(Infinity)
      expect(Object.is(cloneDeep(-0), -0)).to.be.true
    })

    it('should clone bigint and symbol values by reference', () => {
      const big = BigInt(9007199254740993)
      expect(cloneDeep(big)).to.equal(big)
      const sym = Symbol('s')
      expect(cloneDeep(sym)).to.equal(sym)
    })
  })

  describe('plain objects and arrays', () => {
    it('should deep clone a plain object', () => {
      const original = { a: 1, b: { c: 2, d: [3, 4] } }
      const clone = cloneDeep(original)
      expect(clone).to.deep.equal(original)
      expect(clone).to.not.equal(original)
      expect(clone.b).to.not.equal(original.b)
      expect(clone.b.d).to.not.equal(original.b.d)
    })

    it('should not affect the original when mutating a nested clone', () => {
      const original = { a: 1, b: { c: 2 }, list: [1, 2, 3] }
      const clone = cloneDeep(original)
      clone.b.c = 99
      clone.list.push(4)
      expect(original.b.c).to.equal(2)
      expect(original.list).to.deep.equal([1, 2, 3])
    })

    it('should deep clone arrays including nested objects', () => {
      const original = [1, { a: 2 }, [3, 4]]
      const clone = cloneDeep(original)
      expect(clone).to.deep.equal(original)
      expect(clone).to.not.equal(original)
      expect(clone[1]).to.not.equal(original[1])
      expect(clone[2]).to.not.equal(original[2])
    })

    it('should preserve the prototype of class instances', () => {
      class Foo {
        constructor(public value: number) {}
        double() {
          return this.value * 2
        }
      }
      const original = new Foo(21)
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Foo)
      expect(clone.double()).to.equal(42)
      expect(clone).to.not.equal(original)
    })

    it('should preserve undefined-valued own keys', () => {
      const original = { a: undefined, b: 1 }
      const clone = cloneDeep(original)
      expect(Object.keys(clone)).to.have.members(['a', 'b'])
      expect(clone.a).to.be.undefined
    })
  })

  describe('Date and RegExp', () => {
    it('should clone a Date to a distinct instance with the same time', () => {
      const original = new Date(1600000000000)
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Date)
      expect(clone).to.not.equal(original)
      expect(clone.getTime()).to.equal(original.getTime())
    })

    it('should clone a RegExp preserving source and flags', () => {
      const original = /ab+c/gi
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(RegExp)
      expect(clone).to.not.equal(original)
      expect(clone.source).to.equal(original.source)
      expect(clone.flags).to.equal(original.flags)
    })
  })

  describe('Set and Map', () => {
    it('should deep clone a Set', () => {
      const inner = { a: 1 }
      const original = new Set<any>([1, 'two', inner])
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Set)
      expect(clone).to.not.equal(original)
      expect(clone.size).to.equal(3)
      expect(clone.has(1)).to.be.true
      expect(clone.has('two')).to.be.true
      const clonedInner = [...clone].find((v) => typeof v === 'object')
      expect(clonedInner).to.deep.equal(inner)
      expect(clonedInner).to.not.equal(inner)
    })

    it('should deep clone a Map including object keys and values', () => {
      const keyObj = { k: 1 }
      const valObj = { v: 2 }
      const original = new Map<any, any>([
        ['a', valObj],
        [keyObj, 3],
      ])
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Map)
      expect(clone).to.not.equal(original)
      expect(clone.size).to.equal(2)
      const clonedVal = clone.get('a')
      expect(clonedVal).to.deep.equal(valObj)
      expect(clonedVal).to.not.equal(valObj)
      const clonedKey = [...clone.keys()].find((k) => typeof k === 'object')
      expect(clonedKey).to.deep.equal(keyObj)
      expect(clonedKey).to.not.equal(keyObj)
    })
  })

  describe('ArrayBuffer and typed arrays', () => {
    it('should clone a raw ArrayBuffer into a distinct buffer with the same bytes', () => {
      const original = new ArrayBuffer(8)
      new Uint8Array(original).set([1, 2, 3, 4, 5, 6, 7, 8])
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(ArrayBuffer)
      expect(clone).to.not.equal(original)
      expect(clone.byteLength).to.equal(8)
      expect([...new Uint8Array(clone)]).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8])
      // Mutating the clone must not affect the original
      new Uint8Array(clone)[0] = 99
      expect(new Uint8Array(original)[0]).to.equal(1)
    })

    it('should clone a Uint8Array into a distinct, independent view', () => {
      const original = new Uint8Array([10, 20, 30, 40])
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Uint8Array)
      expect(clone).to.not.equal(original)
      expect([...clone]).to.deep.equal([10, 20, 30, 40])
      clone[0] = 255
      expect(original[0]).to.equal(10)
    })

    it('should not alias the underlying buffer of a cloned typed array', () => {
      const original = new Uint8Array([1, 2, 3])
      const clone = cloneDeep(original)
      expect(clone.buffer).to.not.equal(original.buffer)
    })

    it('should clone other typed array types preserving element type', () => {
      const original = new Float64Array([1.5, 2.5, 3.5])
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(Float64Array)
      expect([...clone]).to.deep.equal([1.5, 2.5, 3.5])
      expect(clone).to.not.equal(original)
    })

    it('should clone a typed array that is a partial view of a larger buffer', () => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([0, 1, 2, 3, 4, 5, 6, 7])
      const view = new Uint8Array(buffer, 2, 3) // bytes [2, 3, 4]
      const clone = cloneDeep(view)
      expect(clone).to.be.instanceOf(Uint8Array)
      expect([...clone]).to.deep.equal([2, 3, 4])
      clone[0] = 200
      expect(new Uint8Array(buffer)[2]).to.equal(2)
    })

    it('should clone a DataView into an independent view', () => {
      const buffer = new ArrayBuffer(4)
      const original = new DataView(buffer)
      original.setUint32(0, 0xdeadbeef)
      const clone = cloneDeep(original)
      expect(clone).to.be.instanceOf(DataView)
      expect(clone).to.not.equal(original)
      expect(clone.getUint32(0)).to.equal(0xdeadbeef)
      clone.setUint32(0, 0)
      expect(original.getUint32(0)).to.equal(0xdeadbeef)
    })

    it('should clone a Node Buffer without sharing memory', () => {
      const original = Buffer.from([1, 2, 3, 4])
      const clone = cloneDeep(original)
      expect(Buffer.isBuffer(clone)).to.be.true
      expect(clone).to.not.equal(original)
      expect([...clone]).to.deep.equal([1, 2, 3, 4])
      clone[0] = 99
      expect(original[0]).to.equal(1)
    })

    it('should deep clone an ArrayBuffer nested inside an object without aliasing', () => {
      const picture = new Uint8Array([9, 8, 7, 6]).buffer
      const original = { id: 'x', picture }
      const clone = cloneDeep(original)
      expect(clone.picture).to.not.equal(original.picture)
      expect([...new Uint8Array(clone.picture)]).to.deep.equal([9, 8, 7, 6])
      new Uint8Array(clone.picture)[0] = 0
      expect(new Uint8Array(original.picture)[0]).to.equal(9)
    })
  })

  describe('non-cloneable values', () => {
    it('should copy functions by reference', () => {
      const fn = () => 42
      const original = { fn }
      const clone = cloneDeep(original)
      expect(clone.fn).to.equal(original.fn)
    })
  })
})
