import { before } from 'mocha'

import 'isomorphic-fetch'

import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { createNewHcpApi, getEnvironmentInitializer, setLocalStorage } from '../utils/test_utils'
import { IcureApi } from '../../icc-x-api'
import { IccRelatedPersonApi } from '../../icc-api/api/IccRelatedPersonApi'
import { User } from '../../icc-api/model/User'
import { RelatedPerson } from '../../icc-api/model/RelatedPerson'
import { Patient } from '../../icc-api/model/Patient'
import { Partnership } from '../../icc-api/model/Partnership'
import { Identifier } from '../../icc-api/model/Identifier'
import { ListOfIds } from '../../icc-api/model/ListOfIds'
import { FilterChainRelatedPerson } from '../../icc-api/model/FilterChainRelatedPerson'
import { RelatedPersonByIdsFilter } from '../../icc-x-api/filters/RelatedPersonByIdsFilter'
import { RelatedPersonByDataOwnerIdentifiersFilter } from '../../icc-x-api/filters/RelatedPersonByDataOwnerIdentifiersFilter'
import { RelatedPersonByDataOwnerNameFilter } from '../../icc-x-api/filters/RelatedPersonByDataOwnerNameFilter'
import { EntityWithDelegationTypeName } from '../../icc-x-api/utils/EntityWithDelegationTypeName'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'

setLocalStorage(fetch)
let env: TestVars

async function initApi(): Promise<{ api: IcureApi; user: User; dataOwnerId: string }> {
  const { api, user } = await createNewHcpApi(env)
  return { api, user, dataOwnerId: api.dataOwnerApi.getDataOwnerIdOf(user) }
}

function relatedPersonToCreate(api: IcureApi, user: User, content: Partial<RelatedPerson> = {}) {
  return api.relatedPersonApi.newInstance(
    user,
    new RelatedPerson({
      firstName: 'Jane',
      lastName: `Doe-${randomUUID()}`,
      civility: 'Ms.',
      companyName: 'Acme',
      languages: ['fr', 'en'],
      gender: RelatedPerson.GenderEnum.Female,
      ...content,
    })
  )
}

/**
 * Reads a related person bypassing the decryption of the extended api, to check what the server actually stores.
 */
function getRawRelatedPerson(api: IcureApi, id: string): Promise<RelatedPerson> {
  return IccRelatedPersonApi.prototype.getRelatedPerson.call(api.relatedPersonApi, id)
}

async function expectRejection(promise: Promise<unknown>) {
  let rejected = false
  try {
    await promise
  } catch (e) {
    rejected = true
  }
  expect(rejected, 'expected the promise to be rejected').to.be.true
}

describe('icc-x-related-person-api Tests', function () {
  this.timeout(60000)

  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('newInstance initialises the encryption metadata of a root entity', async () => {
    const { api, user } = await initApi()

    const instance = await api.relatedPersonApi.newInstance(user, { firstName: 'Jane', lastName: 'Doe' })

    expect(instance.id).to.be.a('string')
    expect(instance.rev).to.be.undefined
    expect(instance.created).to.be.a('number')
    expect(instance.modified).to.be.a('number')
    expect(instance.firstName).to.equal('Jane')
    // the metadata is stored in the secure delegations, the legacy maps stay empty
    expect(Object.keys(instance.securityMetadata?.secureDelegations ?? {})).to.have.length.greaterThan(0)
    expect(Object.keys(instance.delegations ?? {})).to.have.length(0)
    expect(Object.keys(instance.encryptionKeys ?? {})).to.have.length(0)
    expect(instance.secretForeignKeys ?? []).to.have.length(0)
    expect(await api.relatedPersonApi.getEncryptionKeysOf(instance)).to.have.length(1)
    expect(await api.relatedPersonApi.getSecretIdsOf(instance)).to.have.length.greaterThan(0)
  })

  it('create, get, modify and delete round-trip with encryption', async () => {
    const { api, user } = await initApi()
    const toCreate = await relatedPersonToCreate(api, user)

    const created = await api.relatedPersonApi.createRelatedPersonWithUser(user, toCreate)

    expect(created.id).to.equal(toCreate.id)
    expect(created.rev).to.be.a('string')
    expect(created.companyName).to.equal('Acme')
    expect(created.languages).to.deep.equal(['fr', 'en'])
    expect(created.civility).to.equal('Ms.')
    expect(created.gender).to.equal(RelatedPerson.GenderEnum.Female)

    const raw = await getRawRelatedPerson(api, created.id!)
    // companyName/languages/civility are part of the encrypted fields by default: the server must not see them in clear
    expect(raw.companyName).to.be.undefined
    expect(raw.languages ?? []).to.be.empty // the server defaults a missing list to []
    expect(raw.civility).to.be.undefined
    expect(raw.encryptedSelf).to.be.a('string')
    // non-encrypted fields stay readable by the server
    expect(raw.firstName).to.equal('Jane')
    expect(raw.lastName).to.equal(toCreate.lastName)

    const fetched = await api.relatedPersonApi.getRelatedPersonWithUser(user, created.id!)
    expect(fetched.companyName).to.equal('Acme')
    expect(fetched.languages).to.deep.equal(['fr', 'en'])

    const modified = await api.relatedPersonApi.modifyRelatedPersonWithUser(user, new RelatedPerson({ ...fetched, companyName: 'Initech' }))
    expect(modified.rev).to.not.equal(created.rev)
    expect(modified.companyName).to.equal('Initech')

    const deleted = await api.relatedPersonApi.deleteRelatedPerson(modified.id!)
    expect(deleted.id).to.equal(modified.id)
  })

  it('batch create, get and modify', async () => {
    const { api, user } = await initApi()
    const toCreate = await Promise.all([relatedPersonToCreate(api, user), relatedPersonToCreate(api, user)])

    const created = await api.relatedPersonApi.createRelatedPersonsWithUser(user, toCreate)
    expect(created.map((x) => x.id).sort()).to.deep.equal(toCreate.map((x) => x.id).sort())
    created.forEach((x) => expect(x.companyName).to.equal('Acme'))

    const fetched = await api.relatedPersonApi.getRelatedPersonsWithUser(user, new ListOfIds({ ids: created.map((x) => x.id!) }))
    expect(fetched).to.have.length(2)
    fetched.forEach((x) => expect(x.languages).to.deep.equal(['fr', 'en']))

    const modified = await api.relatedPersonApi.modifyRelatedPersonsWithUser(
      user,
      fetched.map((x) => new RelatedPerson({ ...x, civility: 'Dr.' }))
    )
    expect(modified).to.have.length(2)
    modified.forEach((x) => expect(x.civility).to.equal('Dr.'))

    expect(await api.relatedPersonApi.createRelatedPersonsWithUser(user, [])).to.deep.equal([])

    const deleted = await api.relatedPersonApi.deleteRelatedPersons(new ListOfIds({ ids: created.map((x) => x.id!) }))
    expect(deleted.map((x) => x.id).sort()).to.deep.equal(created.map((x) => x.id).sort())
  })

  it('raw methods which would return encrypted entities throw', async () => {
    const { api, user } = await initApi()
    const instance = await relatedPersonToCreate(api, user)
    expect(() => api.relatedPersonApi.createRelatedPerson(instance)).to.throw()
    expect(() => api.relatedPersonApi.getRelatedPerson(instance.id!)).to.throw()
    expect(() => api.relatedPersonApi.modifyRelatedPerson(instance)).to.throw()
  })

  it('shares a related person with another data owner', async () => {
    const { api: api1, user: user1 } = await initApi()
    const { api: api2, user: user2, dataOwnerId: dataOwnerId2 } = await initApi()
    const created = await api1.relatedPersonApi.createRelatedPersonWithUser(user1, await relatedPersonToCreate(api1, user1))

    await expectRejection(api2.relatedPersonApi.getRelatedPersonWithUser(user2, created.id!))

    const shared = await api1.relatedPersonApi.shareWith(dataOwnerId2, created)
    expect(Object.values(shared.securityMetadata?.secureDelegations ?? {}).map((d) => d.delegate)).to.include(dataOwnerId2)

    const readByOther = await api2.relatedPersonApi.getRelatedPersonWithUser(user2, created.id!)
    expect(readByOther.companyName).to.equal('Acme')
    expect(await api2.relatedPersonApi.hasWriteAccess(readByOther)).to.be.true
    expect(await api2.relatedPersonApi.getEncryptionKeysOf(readByOther)).to.deep.equal(await api1.relatedPersonApi.getEncryptionKeysOf(created))
    const { permissionsByDataOwnerId } = await api1.relatedPersonApi.getDataOwnersWithAccessTo(shared)
    expect(Object.keys(permissionsByDataOwnerId)).to.include.members([api1.dataOwnerApi.getDataOwnerIdOf(user1), dataOwnerId2])
  })

  describe('filters', () => {
    let api: IcureApi
    let user: User
    let dataOwnerId: string
    let withIdentifier: RelatedPerson
    let withName: RelatedPerson
    const uniqueSystem = `system-${randomUUID()}`
    const uniqueValue = `value-${randomUUID()}`
    const uniqueLastName = `Zzz${randomUUID().replace(/-/g, '')}`

    before(async () => {
      ;({ api, user, dataOwnerId } = await initApi())
      withIdentifier = await api.relatedPersonApi.createRelatedPersonWithUser(
        user,
        await relatedPersonToCreate(api, user, { identifier: [new Identifier({ system: uniqueSystem, value: uniqueValue })] })
      )
      withName = await api.relatedPersonApi.createRelatedPersonWithUser(user, await relatedPersonToCreate(api, user, { lastName: uniqueLastName }))
    })

    it('by ids', async () => {
      const ids = [withIdentifier.id!, withName.id!]
      const matched = await api.relatedPersonApi.matchRelatedPersonsBy(new RelatedPersonByIdsFilter({ ids }))
      expect(matched.sort()).to.deep.equal([...ids].sort())

      const page = await api.relatedPersonApi.filterByWithUser(user, new FilterChainRelatedPerson({ filter: new RelatedPersonByIdsFilter({ ids }) }))
      expect(page.rows?.map((x) => x.id).sort()).to.deep.equal([...ids].sort())
      page.rows?.forEach((x) => expect(x.companyName).to.equal('Acme'))
    })

    it('by data owner identifiers', async () => {
      const matched = await api.relatedPersonApi.matchRelatedPersonsBy(
        new RelatedPersonByDataOwnerIdentifiersFilter({ dataOwnerId, identifiers: [new Identifier({ system: uniqueSystem, value: uniqueValue })] })
      )
      expect(matched).to.deep.equal([withIdentifier.id])
    })

    it('by data owner name', async () => {
      const matched = await api.relatedPersonApi.matchRelatedPersonsBy(new RelatedPersonByDataOwnerNameFilter({ dataOwnerId, name: uniqueLastName }))
      expect(matched).to.deep.equal([withName.id])
    })

    it('all related persons of a data owner', async () => {
      const matched = await api.relatedPersonApi.matchRelatedPersonsBy(new RelatedPersonByDataOwnerNameFilter({ dataOwnerId }))
      expect(matched).to.include.members([withIdentifier.id!, withName.id!])
    })
  })

  it('can be referenced from a patient partnership through partnerType', async () => {
    const { api, user } = await initApi()
    const relatedPerson = await api.relatedPersonApi.createRelatedPersonWithUser(user, await relatedPersonToCreate(api, user))

    const patient = await api.patientApi.createPatientWithUser(
      user,
      await api.patientApi.newInstance(
        user,
        new Patient({
          firstName: 'Child',
          lastName: 'Patient',
          partnerships: [
            new Partnership({
              type: Partnership.TypeEnum.PrimaryContact,
              status: Partnership.StatusEnum.Active,
              partnerId: relatedPerson.id,
              partnerType: Partnership.PartnerTypeEnum.RelatedPerson,
            }),
          ],
        })
      )
    )
    const fetched = await api.patientApi.getPatientWithUser(user, patient!.id!)

    expect(fetched.partnerships).to.have.length(1)
    expect(fetched.partnerships![0].partnerId).to.equal(relatedPerson.id)
    expect(fetched.partnerships![0].partnerType).to.equal(Partnership.PartnerTypeEnum.RelatedPerson)
  })

  it('exposes RelatedPerson as an entity type with delegations', () => {
    expect(EntityWithDelegationTypeName.RelatedPerson).to.equal('RelatedPerson')
  })
})
