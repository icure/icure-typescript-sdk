import {expect} from 'chai'
import {arrayEquals, objectEquals, setEquals} from "../../icc-x-api/utils/collection-utils"

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
    const objA = {a: 1, b: 2}
    const objB = {a: 1, b: 2}
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with different properties', () => {
    const objA: any = {a: 1, b: 2}
    const objB: any = {a: 1, c: 3}
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for objects with nested identical objects', () => {
    const objA = {a: 1, b: {c: 3, d: 4}}
    const objB = {a: 1, b: {c: 3, d: 4}}
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with nested different objects', () => {
    const objA = {a: 1, b: {c: 3, d: 4}}
    const objB = {a: 1, b: {c: 3, d: 5}}
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for objects with identical arrays', () => {
    const objA = {a: 1, b: [1, 2, 3]}
    const objB = {a: 1, b: [1, 2, 3]}
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should return false for objects with different arrays', () => {
    const objA = {a: 1, b: [1, 2, 3]}
    const objB = {a: 1, b: [1, 2, 4]}
    expect(objectEquals(objA, objB)).to.be.false
  })

  it('should return true for deeply nested objects', () => {
    const objA = {a: 1, b: {c: {d: 4, e: 5}}}
    const objB = {a: 1, b: {c: {d: 4, e: 5}}}
    expect(objectEquals(objA, objB)).to.be.true
  })

  it('should respect ignoredProperties', () => {
    const objA: any = {a: 1, b: 2, c: 3}
    const objB: any = {a: 1, b: 2, d: 4}
    expect(objectEquals(objA, objB, ['c', 'd'])).to.be.true
  })
})

describe('arrayEquals', () => {
  it('should return true for two empty arrays', () => {
    expect(arrayEquals([], [])).to.be.true
  })

  it('should return true for two identical arrays of primitives', () => {
    expect(arrayEquals(["1", 2, 3], ["1", 2, 3])).to.be.true
  })

  it('should return false for two different arrays of primitives', () => {
    expect(arrayEquals(["1", 2, 3], [1, 2, 3])).to.be.false
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
    const objA = {a: 1, b: 2}
    const objB = {a: 1, b: 2}
    expect(arrayEquals([objA], [objB])).to.be.true
  })

  it('should return false for arrays with different objects', () => {
    const objA: any = {a: 1, b: 2}
    const objB: any = {a: 1, c: 3}
    expect(arrayEquals([objA], [objB])).to.be.false
  })

  it('should return true for arrays with deeply nested structures', () => {
    const nestedArray = [1, {a: [2, 3, {b: 4}]}, 5]
    expect(arrayEquals(nestedArray, nestedArray)).to.be.true
  })

  it('should return false for arrays with differently nested structures', () => {
    const nestedArray1 = [1, {a: [2, 3, {b: 4}]}, 5]
    const nestedArray2 = [1, {a: [2, 3, {b: 5}]}, 5]
    expect(arrayEquals(nestedArray1, nestedArray2)).to.be.false
  })
})
