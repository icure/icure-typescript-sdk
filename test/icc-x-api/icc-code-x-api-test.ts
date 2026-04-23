import { describe, it } from 'mocha'
import { expect } from 'chai'
import { icdChapters, icpcChapters } from '../../icc-x-api'
import icd10 from '../../icc-x-api/rsrc/icd10'
import icpc2 from '../../icc-x-api/rsrc/icpc2'

describe('icdChapters', () => {
  it('should group codes into the correct chapter', () => {
    const result = icdChapters(['A01', 'A02'], icd10)

    expect(result).to.have.length(1)
    expect(result[0].code).to.equal('A0')
    expect(result[0].subCodes).to.deep.equal(['A01', 'A02'])
    expect(result[0].descr).to.have.property('en')
  })

  it('should split codes across different chapters', () => {
    const result = icdChapters(['A01', 'C10', 'E50'], icd10)

    expect(result).to.have.length(3)
    expect(result.map((c) => c.code)).to.include.members(['A0', 'C0', 'E0'])
  })

  it('should return results sorted by code', () => {
    const codes = icdChapters(['E50', 'A01', 'C10'], icd10).map((c) => c.code)

    expect(codes).to.deep.equal([...codes].sort())
  })

  it('should ignore unmatched codes', () => {
    expect(icdChapters(['ZZZ'], icd10)).to.have.length(0)
  })

  it('should return empty for empty input', () => {
    expect(icdChapters([], icd10)).to.deep.equal([])
  })

  it('should collect codes from the same range into one chapter', () => {
    const result = icdChapters(['A01', 'A50', 'B10'], icd10)

    expect(result).to.have.length(1)
    expect(result[0].subCodes).to.include.members(['A01', 'A50', 'B10'])
  })

  it('should preserve the description from the data', () => {
    const result = icdChapters(['F10'], icd10)

    expect(result[0].descr.en).to.equal('Mental and behavioural disorders')
  })
})

describe('icpcChapters', () => {
  it('should group codes by their first letter', () => {
    const result = icpcChapters(['A01', 'A73'], icpc2)

    expect(result).to.have.length(1)
    expect(result[0].code).to.equal('A')
    expect(result[0].subCodes).to.deep.equal(['A01', 'A73'])
    expect(result[0].descr).to.have.property('en')
  })

  it('should split codes across different chapters', () => {
    const result = icpcChapters(['A01', 'D05', 'K99'], icpc2)

    expect(result).to.have.length(3)
    expect(result.map((c) => c.code)).to.include.members(['A', 'D', 'K'])
  })

  it('should return results sorted by code', () => {
    const codes = icpcChapters(['K99', 'A01', 'D05'], icpc2).map((c) => c.code)

    expect(codes).to.deep.equal([...codes].sort())
  })

  it('should ignore codes with no matching chapter letter', () => {
    expect(icpcChapters(['C01', 'E05'], icpc2)).to.have.length(0)
  })

  it('should return empty for empty input', () => {
    expect(icpcChapters([], icpc2)).to.deep.equal([])
  })

  it('should handle lowercase input codes', () => {
    const result = icpcChapters(['a01', 'a73'], icpc2)

    expect(result).to.have.length(1)
    expect(result[0].code).to.equal('A')
  })

  it('should preserve the description from the data', () => {
    const result = icpcChapters(['K01'], icpc2)

    expect(result[0].descr.en).to.equal('Circulatory')
  })
})
