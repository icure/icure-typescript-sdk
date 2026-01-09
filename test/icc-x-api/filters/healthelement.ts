import { before } from 'mocha'
import 'isomorphic-fetch'
import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { getEnvironmentInitializer, setLocalStorage, createNewHcpApi } from '../../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import { Patient } from '../../../icc-api/model/Patient'
import { CodeStub } from '../../../icc-api/model/CodeStub'
import { Identifier } from '../../../icc-api/model/Identifier'
import { HealthElementByHcPartyTagFilter } from '../../../icc-x-api/filters/HealthElementByHcPartyTagFilter'
import { HealthElementByHcPartyCodeFilter } from '../../../icc-x-api/filters/HealthElementByHcPartyCodeFilter'
import { HealthElementByHcPartyIdentifiersVersioningFilter } from '../../../icc-x-api/filters/HealthElementByHcPartyIdentifiersVersioningFilter'
import { HealthElementByHcPartyStatusVersioningFilter } from '../../../icc-x-api/filters/HealthElementByHcPartyStatusVersioningFilter'
import { VersionFiltering } from '../../../icc-x-api/filters/VersionFiltering'

setLocalStorage(fetch)
let env: TestVars

async function initHcpApiAndPatient() {
  const { api, user } = await createNewHcpApi(env)

  const patient = await api.patientApi.createPatientWithUser(
    user,
    await api.patientApi.newInstance(
      user,
      new Patient({
        id: randomUUID(),
        firstName: 'Test',
        lastName: 'Patient',
      })
    )
  )

  return { api, user, patient }
}

describe('HealthElement Filters Tests', () => {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('HealthElementByHcPartyTagFilter with VersionFiltering.LATEST should return correct health elements', async () => {
    // Given - Create a new HCP and initialize the api
    const { api, user, patient } = await initHcpApiAndPatient()
    const hcpId = user.healthcarePartyId!

    // Target tag to search for
    const targetTagType = 'CD-LIFECYCLE'
    const targetTagCode = 'active'
    const matchingTag = new CodeStub({ id: `${targetTagType}|${targetTagCode}|1`, type: targetTagType, code: targetTagCode, version: '1' })
    const nonMatchingTag = new CodeStub({ id: 'CD-LIFECYCLE|inactive|1', type: 'CD-LIFECYCLE', code: 'inactive', version: '1' })

    // Helper to create and save a health element
    async function createHealthElement(opts: { tags: CodeStub[]; healthElementId?: string; modified?: number }): Promise<HealthElement> {
      const he = await api.healthcareElementApi.newInstance(
        user,
        patient,
        new HealthElement({
          id: randomUUID(),
          healthElementId: opts.healthElementId,
          tags: opts.tags,
          modified: opts.modified,
          note: 'Test health element',
        })
      )
      return api.healthcareElementApi.createHealthElementWithUser(user, he)
    }

    // 1. A health element with the matching tag and no healthElementId
    const he1 = await createHealthElement({ tags: [matchingTag] })

    // 2. A health element with the matching tag and a healthElementId
    const he2HealthElementId = randomUUID()
    const he2 = await createHealthElement({ tags: [matchingTag], healthElementId: he2HealthElementId })

    // 3. Two health elements with same healthElementId, different modified times:
    //    3a. lowest modified has matching tag
    //    3b. highest modified does not have matching tag (this is the latest version)
    const he3HealthElementId = randomUUID()
    const he3a = await createHealthElement({
      tags: [matchingTag],
      healthElementId: he3HealthElementId,
      modified: 1000,
    })
    const he3b = await createHealthElement({
      tags: [nonMatchingTag],
      healthElementId: he3HealthElementId,
      modified: 2000,
    })

    // 4. Two health elements with same healthElementId, different modified times:
    //    4a. lowest modified does not have matching tag
    //    4b. highest modified has matching tag (this is the latest version)
    const he4HealthElementId = randomUUID()
    const he4a = await createHealthElement({
      tags: [nonMatchingTag],
      healthElementId: he4HealthElementId,
      modified: 1000,
    })
    const he4b = await createHealthElement({
      tags: [matchingTag],
      healthElementId: he4HealthElementId,
      modified: 2000,
    })

    // 5. A health element without the matching tag and no healthElementId
    const he5 = await createHealthElement({ tags: [nonMatchingTag] })

    // 6. A health element without the matching tag and a healthElementId
    const he6HealthElementId = randomUUID()
    const he6 = await createHealthElement({ tags: [nonMatchingTag], healthElementId: he6HealthElementId })

    // When - Use the filter with match method
    const filter = new HealthElementByHcPartyTagFilter({
      healthcarePartyId: hcpId,
      tagType: targetTagType,
      tagCode: targetTagCode,
      versionFiltering: VersionFiltering.LATEST,
    })

    const matchedIds = await api.healthcareElementApi.matchHealthElementsBy(filter)

    // Then - Should find 1, 2, 4b and not 3a, 3b, 4a, 5, 6
    expect(matchedIds).to.have.members([he1.id, he2.id, he4b.id])
  })

  it('HealthElementByHcPartyCodeFilter with VersionFiltering.LATEST should return correct health elements', async () => {
    // Given - Create a new HCP and initialize the api
    const { api, user, patient } = await initHcpApiAndPatient()
    const hcpId = user.healthcarePartyId!

    // Target code to search for
    const targetCodeType = 'SNOMED'
    const targetCodeCode = '38341003'
    const matchingCode = new CodeStub({ id: `${targetCodeType}|${targetCodeCode}|2`, type: targetCodeType, code: targetCodeCode, version: '2' })
    const nonMatchingCode = new CodeStub({ id: 'SNOMED|73211009|2', type: 'SNOMED', code: '73211009', version: '2' })

    // Helper to create and save a health element
    async function createHealthElement(opts: { codes: CodeStub[]; healthElementId?: string; modified?: number }): Promise<HealthElement> {
      const he = await api.healthcareElementApi.newInstance(
        user,
        patient,
        new HealthElement({
          id: randomUUID(),
          healthElementId: opts.healthElementId,
          codes: opts.codes,
          modified: opts.modified,
          note: 'Test health element',
        })
      )
      return api.healthcareElementApi.createHealthElementWithUser(user, he)
    }

    // 1. A health element with the matching code and no healthElementId
    const he1 = await createHealthElement({ codes: [matchingCode] })

    // 2. A health element with the matching code and a healthElementId
    const he2HealthElementId = randomUUID()
    const he2 = await createHealthElement({ codes: [matchingCode], healthElementId: he2HealthElementId })

    // 3. Two health elements with same healthElementId, different modified times:
    //    3a. lowest modified has matching code
    //    3b. highest modified does not have matching code (this is the latest version)
    const he3HealthElementId = randomUUID()
    const he3a = await createHealthElement({
      codes: [matchingCode],
      healthElementId: he3HealthElementId,
      modified: 1000,
    })
    const he3b = await createHealthElement({
      codes: [nonMatchingCode],
      healthElementId: he3HealthElementId,
      modified: 2000,
    })

    // 4. Two health elements with same healthElementId, different modified times:
    //    4a. lowest modified does not have matching code
    //    4b. highest modified has matching code (this is the latest version)
    const he4HealthElementId = randomUUID()
    const he4a = await createHealthElement({
      codes: [nonMatchingCode],
      healthElementId: he4HealthElementId,
      modified: 1000,
    })
    const he4b = await createHealthElement({
      codes: [matchingCode],
      healthElementId: he4HealthElementId,
      modified: 2000,
    })

    // 5. A health element without the matching code and no healthElementId
    const he5 = await createHealthElement({ codes: [nonMatchingCode] })

    // 6. A health element without the matching code and a healthElementId
    const he6HealthElementId = randomUUID()
    const he6 = await createHealthElement({ codes: [nonMatchingCode], healthElementId: he6HealthElementId })

    // When - Use the filter with match method
    const filter = new HealthElementByHcPartyCodeFilter({
      healthcarePartyId: hcpId,
      codeType: targetCodeType,
      codeCode: targetCodeCode,
      versionFiltering: VersionFiltering.LATEST,
    })

    const matchedIds = await api.healthcareElementApi.matchHealthElementsBy(filter)

    // Then - Should find 1, 2, 4b and not 3a, 3b, 4a, 5, 6
    expect(matchedIds).to.have.members([he1.id, he2.id, he4b.id])
  })

  it('HealthElementByHcPartyIdentifiersVersioningFilter with VersionFiltering.LATEST should return correct health elements', async () => {
    // Given - Create a new HCP and initialize the api
    const { api, user, patient } = await initHcpApiAndPatient()
    const hcpId = user.healthcarePartyId!

    // Target identifier to search for
    const matchingIdentifier = new Identifier({
      system: 'https://www.ehealth.fgov.be/standards/kmehr/id/ehealth',
      value: 'test-identifier-123',
    })
    const nonMatchingIdentifier = new Identifier({
      system: 'https://www.ehealth.fgov.be/standards/kmehr/id/ehealth',
      value: 'other-identifier-456',
    })

    // Helper to create and save a health element
    async function createHealthElement(opts: { identifiers: Identifier[]; healthElementId?: string; modified?: number }): Promise<HealthElement> {
      const he = await api.healthcareElementApi.newInstance(
        user,
        patient,
        new HealthElement({
          id: randomUUID(),
          healthElementId: opts.healthElementId,
          identifiers: opts.identifiers,
          modified: opts.modified,
          note: 'Test health element',
        })
      )
      return api.healthcareElementApi.createHealthElementWithUser(user, he)
    }

    // 1. A health element with the matching identifier and no healthElementId
    const he1 = await createHealthElement({ identifiers: [matchingIdentifier] })

    // 2. A health element with the matching identifier and a healthElementId
    const he2HealthElementId = randomUUID()
    const he2 = await createHealthElement({ identifiers: [matchingIdentifier], healthElementId: he2HealthElementId })

    // 3. Two health elements with same healthElementId, different modified times:
    //    3a. lowest modified has matching identifier
    //    3b. highest modified does not have matching identifier (this is the latest version)
    const he3HealthElementId = randomUUID()
    const he3a = await createHealthElement({
      identifiers: [matchingIdentifier],
      healthElementId: he3HealthElementId,
      modified: 1000,
    })
    const he3b = await createHealthElement({
      identifiers: [nonMatchingIdentifier],
      healthElementId: he3HealthElementId,
      modified: 2000,
    })

    // 4. Two health elements with same healthElementId, different modified times:
    //    4a. lowest modified does not have matching identifier
    //    4b. highest modified has matching identifier (this is the latest version)
    const he4HealthElementId = randomUUID()
    const he4a = await createHealthElement({
      identifiers: [nonMatchingIdentifier],
      healthElementId: he4HealthElementId,
      modified: 1000,
    })
    const he4b = await createHealthElement({
      identifiers: [matchingIdentifier],
      healthElementId: he4HealthElementId,
      modified: 2000,
    })

    // 5. A health element without the matching identifier and no healthElementId
    const he5 = await createHealthElement({ identifiers: [nonMatchingIdentifier] })

    // 6. A health element without the matching identifier and a healthElementId
    const he6HealthElementId = randomUUID()
    const he6 = await createHealthElement({ identifiers: [nonMatchingIdentifier], healthElementId: he6HealthElementId })

    // When - Use the filter with match method
    const filter = new HealthElementByHcPartyIdentifiersVersioningFilter({
      hcPartyId: hcpId,
      identifiers: [matchingIdentifier],
      versionFiltering: VersionFiltering.LATEST,
    })

    const matchedIds = await api.healthcareElementApi.matchHealthElementsBy(filter)

    // Then - Should find 1, 2, 4b and not 3a, 3b, 4a, 5, 6
    expect(matchedIds).to.have.members([he1.id, he2.id, he4b.id])
  })

  it('HealthElementByHcPartyStatusVersioningFilter with VersionFiltering.LATEST should return correct health elements', async () => {
    // Given - Create a new HCP and initialize the api
    const { api, user, patient } = await initHcpApiAndPatient()
    const hcpId = user.healthcarePartyId!

    // Target status to search for (bit 0: active=0/inactive=1, bit 1: relevant=0/irrelevant=1, bit 2: present=0/absent=1)
    const matchingStatus = 0 // active, relevant, present
    const nonMatchingStatus = 1 // inactive, relevant, present

    // Helper to create and save a health element
    async function createHealthElement(opts: { status: number; healthElementId?: string; modified?: number }): Promise<HealthElement> {
      const he = await api.healthcareElementApi.newInstance(
        user,
        patient,
        new HealthElement({
          id: randomUUID(),
          healthElementId: opts.healthElementId,
          status: opts.status,
          modified: opts.modified,
          note: 'Test health element',
        })
      )
      return api.healthcareElementApi.createHealthElementWithUser(user, he)
    }

    // 1. A health element with the matching status and no healthElementId
    const he1 = await createHealthElement({ status: matchingStatus })

    // 2. A health element with the matching status and a healthElementId
    const he2HealthElementId = randomUUID()
    const he2 = await createHealthElement({ status: matchingStatus, healthElementId: he2HealthElementId })

    // 3. Two health elements with same healthElementId, different modified times:
    //    3a. lowest modified has matching status
    //    3b. highest modified does not have matching status (this is the latest version)
    const he3HealthElementId = randomUUID()
    const he3a = await createHealthElement({
      status: matchingStatus,
      healthElementId: he3HealthElementId,
      modified: 1000,
    })
    const he3b = await createHealthElement({
      status: nonMatchingStatus,
      healthElementId: he3HealthElementId,
      modified: 2000,
    })

    // 4. Two health elements with same healthElementId, different modified times:
    //    4a. lowest modified does not have matching status
    //    4b. highest modified has matching status (this is the latest version)
    const he4HealthElementId = randomUUID()
    const he4a = await createHealthElement({
      status: nonMatchingStatus,
      healthElementId: he4HealthElementId,
      modified: 1000,
    })
    const he4b = await createHealthElement({
      status: matchingStatus,
      healthElementId: he4HealthElementId,
      modified: 2000,
    })

    // 5. A health element without the matching status and no healthElementId
    const he5 = await createHealthElement({ status: nonMatchingStatus })

    // 6. A health element without the matching status and a healthElementId
    const he6HealthElementId = randomUUID()
    const he6 = await createHealthElement({ status: nonMatchingStatus, healthElementId: he6HealthElementId })

    // When - Use the filter with match method
    const filter = new HealthElementByHcPartyStatusVersioningFilter({
      hcPartyId: hcpId,
      status: matchingStatus,
      versionFiltering: VersionFiltering.LATEST,
    })

    const matchedIds = await api.healthcareElementApi.matchHealthElementsBy(filter)

    // Then - Should find 1, 2, 4b and not 3a, 3b, 4a, 5, 6
    expect(matchedIds).to.have.members([he1.id, he2.id, he4b.id])
  })
})
