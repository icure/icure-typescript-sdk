/* make node behave */
import { expect } from 'chai'
import 'mocha'

import { a2b, b2a, string2ua, ua2string, b64_2ua, ua2b64 } from '../../../icc-api/model/ModelHelper'

function getRaw(size: number) {
  return 'x'.repeat(size).replace(/./g, () => String.fromCharCode(Math.random() * 256))
}

describe('invariants', () => {
  it('should support b64 -> binary and vice versa', () => {
    const raw = getRaw(1024)
    const b64 = b2a(raw)

    expect(a2b(b2a(raw))).to.equal(raw)
    expect(b2a(a2b(b64))).to.equal(b64)
  })

  it('should support string2ua and vice versa', () => {
    const raw = getRaw(1024)
    const uint8Array = string2ua(raw)

    expect(ua2string(string2ua(raw))).to.equal(raw)
    expect(string2ua(ua2string(uint8Array))).to.deep.eq(uint8Array)
  })

  it('should support b64 -> ab and vice versa', () => {
    const raw = getRaw(1024)
    const b64 = b2a(raw)
    const ua = string2ua(raw)

    expect(ua2b64(b64_2ua(b64))).to.equal(b64)
    expect(b64_2ua(ua2b64(ua))).to.deep.eq(ua)
  })

  it('Cross conversions should work too', () => {
    const raw = getRaw(1024)
    const b64 = b2a(raw)
    const ua = string2ua(raw)

    expect(b2a(ua2string(b64_2ua(b64)))).to.equal(b64)
    expect(string2ua(a2b(ua2b64(ua)))).to.deep.eq(ua)
  })

  it('should support b64 -> ab and vice versa for big data set', () => {
    const raw = getRaw(30 * 1024 * 1024)
    const b64 = b2a(raw)
    const ua = string2ua(raw)

    expect(ua2b64(b64_2ua(b64))).to.equal(b64)
    expect(b64_2ua(ua2b64(ua))).to.deep.eq(ua)
  }).timeout(120000)
})
