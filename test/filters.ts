import { crypto } from '../node-compat'
import { ShamirClass } from '../icc-x-api/crypto/shamir'
import { expect } from 'chai'
import 'mocha'
import { FilterFor } from '../icc-x-api/filters/filters'

describe('Composition', () => {
  it('or should return an or combining other filters', () => {
    const builder = FilterFor.patient().forHcp('me').olderThan(65).or().youngerThan(18)
    const filter = builder.build()

    expect((filter as any).$type).to.equal('UnionFilter')
  })

  it('and should work with or', () => {
    const builder = FilterFor.patient().forHcp('me').olderThan(65).or().youngerThan(18).and().searchByName('dup')
    const filter = builder.build()

    expect((filter as any).$type).to.equal('IntersectionFilter')
    expect((filter as any).filters[0].$type).to.equal('UnionFilter')
  })

  it('precedence of operators can be managed for and/or', () => {
    const builder = FilterFor.patient()
      .forHcp('me')
      .olderThan(65)
      .or((it) => it.youngerThan(18).and().searchByName('dup'))
    const filter = builder.build()

    expect((filter as any).$type).to.equal('UnionFilter')
    expect((filter as any).filters[0].$type).to.equal('PatientByHcPartyDateOfBirthBetweenFilter')
    expect((filter as any).filters[1].$type).to.equal('IntersectionFilter')
  })

  it('and should work with and', () => {
    const builder = FilterFor.patient().youngerThan(65).and().olderThan(18).and().searchByName('dup')
    const filter = builder.build()

    expect((filter as any).$type).to.equal('IntersectionFilter')
    expect((filter as any).filters[0].$type).to.equal('IntersectionFilter')
  })

  it('should not crash miserably on incomplete or/and', () => {
    const builder = FilterFor.patient().youngerThan(65).and()
    const filter = builder.build()

    expect((filter as any).$type).to.equal('IntersectionFilter')
    expect((filter as any).filters[0].$type).to.equal('PatientByHcPartyDateOfBirthBetweenFilter')
    expect((filter as any).filters[1].$type).to.equal('PatientByHcPartyFilter')
  })

  it('should not crash miserably on combination of or/and', () => {
    const builder = FilterFor.patient().youngerThan(65).and().or().olderThan(75)
    const filter = builder.build()

    expect((filter as any).$type).to.equal('IntersectionFilter')
    expect((filter as any).filters[0].$type).to.equal('PatientByHcPartyDateOfBirthBetweenFilter')
    expect((filter as any).filters[1].$type).to.equal('PatientByHcPartyDateOfBirthBetweenFilter')
  })
})
