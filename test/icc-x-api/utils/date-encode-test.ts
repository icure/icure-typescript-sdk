import { describe, it } from 'mocha'
import { expect } from 'chai'
import { dateEncode, timeEncode } from '../../../icc-x-api/utils/formatting-util'

describe('dateEncode', () => {
  it('should return undefined for undefined/null input', () => {
    expect(dateEncode(undefined)).to.be.undefined
    expect(dateEncode(null)).to.be.undefined
  })

  it('should return undefined for falsy String/Number input', () => {
    expect(dateEncode('')).to.be.undefined
    expect(dateEncode('   ')).to.be.undefined
    expect(dateEncode(0)).to.be.undefined
  })

  it('should return undefined for non-numeric String input', () => {
    expect(dateEncode('not a date')).to.be.undefined
  })

  it('should encode a Date as a yyyyMMdd number', () => {
    expect(dateEncode(new Date(1985, 2, 15))).to.equal(19850315)
  })

  it('should keep a yyyyMMdd fuzzy date Number unchanged', () => {
    expect(dateEncode(19850315)).to.equal(19850315)
  })

  it('should keep a yyyyMMdd fuzzy date String unchanged', () => {
    expect(dateEncode('19850315')).to.equal(19850315)
  })

  it('should handle the yyyyMMdd boundaries', () => {
    expect(dateEncode(18000101)).to.equal(18000101)
    expect(dateEncode(25391231)).to.equal(25391231)
  })

  it('should truncate a yyyyMMddHHmmss fuzzy date to its date part', () => {
    expect(dateEncode(20230415143022)).to.equal(20230415)
    expect(dateEncode('20230415143022')).to.equal(20230415)
  })

  it('should treat a small Number as an epoch in milliseconds', () => {
    const epoch = new Date(2023, 0, 15, 12, 0, 0).getTime()
    expect(dateEncode(epoch)).to.equal(20230115)
  })
})

describe('timeEncode', () => {
  it('should return undefined for undefined/null input', () => {
    expect(timeEncode(undefined)).to.be.undefined
    expect(timeEncode(null)).to.be.undefined
  })

  it('should return undefined for falsy String/Number input', () => {
    expect(timeEncode('')).to.be.undefined
    expect(timeEncode('   ')).to.be.undefined
    expect(timeEncode(0)).to.be.undefined
  })

  it('should return undefined for non-numeric String input', () => {
    expect(timeEncode('not a date')).to.be.undefined
  })

  it('should encode a Date as a yyyyMMddHHmmss number', () => {
    expect(timeEncode(new Date(2023, 3, 15, 14, 30, 22))).to.equal(20230415143022)
  })

  it('should pad a yyyyMMdd fuzzy date with a zero time part', () => {
    expect(timeEncode(19850315)).to.equal(19850315000000)
    expect(timeEncode('19850315')).to.equal(19850315000000)
  })

  it('should keep a yyyyMMddHHmmss fuzzy date unchanged', () => {
    expect(timeEncode(20230415143022)).to.equal(20230415143022)
    expect(timeEncode('20230415143022')).to.equal(20230415143022)
  })

  it('should treat a small Number as an epoch in milliseconds', () => {
    const epoch = new Date(2023, 0, 15, 12, 30, 45).getTime()
    expect(timeEncode(epoch)).to.equal(20230115123045)
  })
})