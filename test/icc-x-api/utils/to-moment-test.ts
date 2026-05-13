import { describe, it } from 'mocha'
import { expect } from 'chai'
import { momentFormatToDateFnsFormat, toMoment } from '../../../icc-x-api/utils/formatting-util'

describe('toMoment', () => {
  it('should return undefined for undefined/null/NaN input', () => {
    expect(toMoment(undefined)).to.be.undefined
    expect(toMoment(null)).to.be.undefined
    expect(toMoment(NaN)).to.be.undefined
  })

  it('should handle 0 as a valid epoch timestamp', () => {
    const result = toMoment(0)
    expect(result).to.not.be.null
    expect(result!.format('YYYY')).to.equal('1970')
  })

  it('should parse YYYYMMDD long calendar dates', () => {
    const result = toMoment(19850315)
    expect(result).to.not.be.null
    expect(result!.format('YYYY-MM-DD')).to.equal('1985-03-15')
  })

  it('should parse YYYYMMDD at the lower boundary (18000101)', () => {
    const result = toMoment(18000101)
    expect(result).to.not.be.null
    expect(result!.format('YYYY-MM-DD')).to.equal('1800-01-01')
  })

  it('should parse YYYYMMDD at the upper boundary (25399999)', () => {
    const result = toMoment(25391231)
    expect(result).to.not.be.null
    expect(result!.format('YYYY-MM-DD')).to.equal('2539-12-31')
  })

  it('should parse YYYYMMDDHHmmss long calendar datetimes', () => {
    const result = toMoment(20230415143022)
    expect(result).to.not.be.null
    expect(result!.format('YYYY-MM-DD HH:mm:ss')).to.equal('2023-04-15 14:30:22')
  })

  it('should parse epoch timestamps in milliseconds', () => {
    const epoch = new Date(2023, 0, 15, 12, 0, 0).getTime()
    const result = toMoment(epoch)
    expect(result).to.not.be.null
    expect(result!.format('YYYY-MM-DD')).to.equal('2023-01-15')
    expect(result!.format('HH')).to.equal('12')
  })

  it('should treat small numbers (< 18000101) as epoch timestamps', () => {
    const result = toMoment(1000)
    expect(result).to.not.be.null
    expect(result!.format('YYYY')).to.equal('1970')
  })

  it('should support various moment format strings', () => {
    const result = toMoment(20001225)
    expect(result).to.not.be.null
    expect(result!.format('DD/MM/YYYY')).to.equal('25/12/2000')
    expect(result!.format('MM-DD-YYYY')).to.equal('12-25-2000')
    expect(result!.format('YYYY')).to.equal('2000')
  })

  it('should support 12-hour clock with AM/PM (moment A/a)', () => {
    const result = toMoment(20230415143022)
    expect(result).to.not.be.null
    expect(result!.format('h:mm A')).to.equal('2:30 PM')
    expect(result!.format('h:mm a')).to.equal('2:30 pm')
  })

  it('should support bracketed literals', () => {
    const result = toMoment(20230415)
    expect(result).to.not.be.null
    expect(result!.format('[Year:] YYYY')).to.equal('Year: 2023')
  })

  it('should support weekday names', () => {
    // 2023-04-15 was a Saturday
    const result = toMoment(20230415)
    expect(result).to.not.be.null
    expect(result!.format('dddd')).to.equal('Saturday')
    expect(result!.format('ddd')).to.equal('Sat')
  })
})

describe('momentFormatToDateFnsFormat', () => {
  it('converts year tokens', () => {
    expect(momentFormatToDateFnsFormat('YYYY')).to.equal('yyyy')
    expect(momentFormatToDateFnsFormat('YY')).to.equal('yy')
  })

  it('converts day-of-month tokens (D → d, DD → dd)', () => {
    expect(momentFormatToDateFnsFormat('DD')).to.equal('dd')
    expect(momentFormatToDateFnsFormat('D')).to.equal('d')
  })

  it('passes through month/hour/minute/second tokens unchanged', () => {
    expect(momentFormatToDateFnsFormat('MM HH mm ss')).to.equal('MM HH mm ss')
  })

  it('converts AM/PM tokens', () => {
    expect(momentFormatToDateFnsFormat('A')).to.equal('a')
    expect(momentFormatToDateFnsFormat('a')).to.equal('aaa')
  })

  it('converts weekday tokens', () => {
    expect(momentFormatToDateFnsFormat('dddd')).to.equal('EEEE')
    expect(momentFormatToDateFnsFormat('ddd')).to.equal('EEE')
  })

  it('preserves bracketed literals as date-fns single-quoted literals', () => {
    expect(momentFormatToDateFnsFormat('[YYYY]')).to.equal("'YYYY'")
    expect(momentFormatToDateFnsFormat('[at] HH:mm')).to.equal("'at' HH:mm")
  })

  it('escapes stray alphabetic characters that would be date-fns tokens', () => {
    // 't' is a date-fns token (unix timestamp) but a literal in moment.
    expect(momentFormatToDateFnsFormat('YYYY foo')).to.equal("yyyy 'foo'")
  })

  it('escapes single quotes in the input format', () => {
    expect(momentFormatToDateFnsFormat("[o'clock]")).to.equal("'o''clock'")
  })

  it('handles a full common moment format', () => {
    expect(momentFormatToDateFnsFormat('YYYY-MM-DD HH:mm:ss')).to.equal('yyyy-MM-dd HH:mm:ss')
  })
})
