import { describe, it } from 'mocha'
import { expect } from 'chai'
import { toMoment } from '../../../icc-x-api/utils/formatting-util'

describe('toMoment', () => {
  it('should return null for undefined/null/NaN input', () => {
    expect(toMoment(undefined as any)).to.be.null
    expect(toMoment(null as any)).to.be.null
    expect(toMoment(NaN)).to.be.null
  })

  it('should handle 0 as a valid epoch timestamp', () => {
    const result = toMoment(0)
    expect(result).to.not.be.null
    expect(result!.format('yyyy')).to.equal('1970')
  })

  it('should parse YYYYMMDD long calendar dates', () => {
    const result = toMoment(19850315)
    expect(result).to.not.be.null
    expect(result!.format('yyyy-MM-dd')).to.equal('1985-03-15')
  })

  it('should parse YYYYMMDD at the lower boundary (18000101)', () => {
    const result = toMoment(18000101)
    expect(result).to.not.be.null
    expect(result!.format('yyyy-MM-dd')).to.equal('1800-01-01')
  })

  it('should parse YYYYMMDD at the upper boundary (25399999)', () => {
    const result = toMoment(25391231)
    expect(result).to.not.be.null
    expect(result!.format('yyyy-MM-dd')).to.equal('2539-12-31')
  })

  it('should parse YYYYMMDDHHmmss long calendar datetimes', () => {
    const result = toMoment(20230415143022)
    expect(result).to.not.be.null
    expect(result!.format('yyyy-MM-dd HH:mm:ss')).to.equal('2023-04-15 14:30:22')
  })

  it('should parse epoch timestamps in milliseconds', () => {
    // 2023-01-15T12:00:00.000Z
    const epoch = new Date(2023, 0, 15, 12, 0, 0).getTime()
    const result = toMoment(epoch)
    expect(result).to.not.be.null
    expect(result!.format('yyyy-MM-dd')).to.equal('2023-01-15')
    expect(result!.format('HH')).to.equal('12')
  })

  it('should treat small numbers (< 18000101) as epoch timestamps', () => {
    // 1000 ms = 1 second after epoch
    const result = toMoment(1000)
    expect(result).to.not.be.null
    expect(result!.format('yyyy')).to.equal('1970')
  })

  it('should support various format strings', () => {
    const result = toMoment(20001225)
    expect(result).to.not.be.null
    expect(result!.format('dd/MM/yyyy')).to.equal('25/12/2000')
    expect(result!.format('MM-dd-yyyy')).to.equal('12-25-2000')
    expect(result!.format('yyyy')).to.equal('2000')
  })
})
