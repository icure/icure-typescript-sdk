import { createNewHcpApi, getEnvironmentInitializer, setLocalStorage } from '../../utils/test_utils'
import { randomUUID } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import {
  EntityWithDelegationTypeName,
  FailedRequestDetails,
  FailedRequestDetailsFailureType,
  IcureApi,
  SecretIdShareOptions,
  ShareByIdResult,
  ShareMetadataBehaviour,
  ShareRequestPurpose,
  SharedSecretIdsSource,
} from '../../../icc-x-api'
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import { User } from '../../../icc-api/model/User'
import { Patient } from '../../../icc-api/model/Patient'
import { HealthElement } from '../../../icc-api/model/HealthElement'
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

setLocalStorage(fetch)

let env: TestVars

type Hcp = { api: IcureApi; user: User; id: string }

/**
 * The three data owners used across the suite: `owner` creates the entities, `sharer` receives them and is the one
 * actually calling `shareById` in the tests that need the caller's own access to be limited, and `delegate` is the
 * final recipient. They are created once because every test creates its own entities, so nothing an earlier test
 * shared can influence a later one.
 */
let owner: Hcp
let sharer: Hcp
let delegate: Hcp

async function newHcp(): Promise<Hcp> {
  const info = await createNewHcpApi(env)
  return { api: info.api, user: info.user, id: info.credentials.dataOwnerId }
}

async function newPatient(hcp: Hcp, note?: string): Promise<Patient> {
  return hcp.api.patientApi.createPatientWithUser(
    hcp.user,
    await hcp.api.patientApi.newInstance(hcp.user, { firstName: 'John', lastName: `Doe-${randomUUID()}`, note })
  )
}

async function newHealthElement(hcp: Hcp, patient: Patient, note: string): Promise<HealthElement> {
  return hcp.api.healthcareElementApi.createHealthElementWithUser(
    hcp.user,
    await hcp.api.healthcareElementApi.newInstance(hcp.user, patient, { note })
  )
}

/**
 * The successful requests of a plain share, as `{ entityId: [delegateId] }`: every entity in these tests is created
 * by the current sdk, so there is never a legacy delegation to migrate and the purpose of a successful request is
 * always `RequestedShare` - asserted here rather than repeated in each test.
 */
function requestedShares(result: ShareByIdResult): { [entityId: string]: string[] } {
  return Object.fromEntries(
    Object.entries(result.successfulRequestsByEntityId).map(([entityId, requests]) => {
      requests.forEach((request) => expect(request.purpose, `purpose of the request for ${entityId}`).to.equal(ShareRequestPurpose.RequestedShare))
      return [entityId, requests.map((request) => request.delegateId).sort()]
    })
  )
}

function singleError(result: ShareByIdResult, entityId: string, delegateId: string): FailedRequestDetails {
  expect(result.shareErrors).to.have.length(1)
  const error = result.shareErrors[0]
  expect(error.entityId).to.equal(entityId)
  expect(error.delegateId).to.equal(delegateId)
  return error
}

/**
 * The secret ids of a health element that `hcp` can access. Unlike patients, health elements expose no public
 * `decryptSecretIdsOf`, so this goes through the internal utils - which is what the sharing code itself uses to
 * resolve `SecretIdShareOptions.AllAvailable`.
 */
async function accessibleSecretIdsOfHealthElement(hcp: Hcp, id: string): Promise<string[]> {
  const entity = await hcp.api.healthcareElementApi.getHealthElementWithUser(hcp.user, id)
  return hcp.api.cryptoApi.xapi.secretIdsOf({ entity, type: EntityWithDelegationTypeName.HealthElement }, undefined)
}

async function hcpsWithAccessToHealthElement(hcp: Hcp, id: string): Promise<string[]> {
  const entity = await hcp.api.healthcareElementApi.getHealthElementWithUser(hcp.user, id)
  return Object.keys((await hcp.api.healthcareElementApi.getDataOwnersWithAccessTo(entity)).permissionsByDataOwnerId)
}

describe('shareById', function () {
  this.timeout(600000)

  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
    owner = await newHcp()
    sharer = await newHcp()
    delegate = await newHcp()
  })

  it('shares every entity of the batch, giving the delegate access to their encrypted content', async function () {
    const patient = await newPatient(owner)
    const notes = [randomUUID(), randomUUID(), randomUUID()]
    const hes = []
    for (const note of notes) hes.push(await newHealthElement(owner, patient, note))

    const result = await owner.api.healthcareElementApi.shareById(
      hes.map((he) => he.id!),
      { [delegate.id]: {} }
    )

    expect(result.notFoundIds).to.be.empty
    expect(result.shareErrors).to.be.empty
    expect(result.unmodifiedDelegateIdsByEntityId).to.be.empty
    expect(requestedShares(result)).to.deep.equal(Object.fromEntries(hes.map((he) => [he.id!, [delegate.id]])))
    for (const he of hes) {
      const asDelegate = await delegate.api.healthcareElementApi.getHealthElementWithUser(delegate.user, he.id!)
      expect(asDelegate.note).to.equal(he.note)
    }
  })

  it('ignores duplicate ids', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())

    const result = await owner.api.healthcareElementApi.shareById([he.id!, he.id!, he.id!], { [delegate.id]: {} })

    expect(result.notFoundIds).to.be.empty
    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [he.id!]: [delegate.id] })
  })

  it('reports ids that do not exist in notFoundIds, and shares the rest of the batch', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())
    const missing = randomUUID()

    const result = await owner.api.healthcareElementApi.shareById([he.id!, missing], { [delegate.id]: {} })

    expect(result.notFoundIds).to.have.members([missing])
    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [he.id!]: [delegate.id] })
  })

  it('reports ids of entities the current user cannot read in notFoundIds', async function () {
    const ownPatient = await newPatient(owner)
    const own = await newHealthElement(owner, ownPatient, randomUUID())
    const othersPatient = await newPatient(delegate)
    const others = await newHealthElement(delegate, othersPatient, randomUUID())

    const result = await owner.api.healthcareElementApi.shareById([own.id!, others.id!], { [sharer.id]: {} })

    // The delegation stubs endpoint filters by access, so an entity the caller can't read is simply not returned
    // and its id is reported as not found - no request is ever built for it.
    expect(result.notFoundIds).to.have.members([others.id!])
    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [own.id!]: [sharer.id] })
  })

  it('reports a delegate that already has everything as unmodified, while still sharing with the one that needs it', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())
    // `sharer` already has everything beforehand; `delegate` has never seen this health element.
    await owner.api.healthcareElementApi.shareWith(sharer.id, he, {})

    const result = await owner.api.healthcareElementApi.shareById([he.id!], { [sharer.id]: {}, [delegate.id]: {} })

    // Both pairs are accounted for, in different buckets - neither silently disappears.
    expect(result.notFoundIds).to.be.empty
    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [he.id!]: [delegate.id] })
    expect(result.unmodifiedDelegateIdsByEntityId).to.deep.equal({ [he.id!]: [sharer.id] })
  })

  it('fails only for the entity whose encryption key the caller cannot access when it is REQUIRED', async function () {
    const patient = await newPatient(owner)
    const withKey = await newHealthElement(owner, patient, randomUUID())
    const withoutKey = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, withKey, {})
    await owner.api.healthcareElementApi.shareWith(sharer.id, withoutKey, { shareEncryptionKey: ShareMetadataBehaviour.NEVER })

    const result = await sharer.api.healthcareElementApi.shareById([withKey.id!, withoutKey.id!], {
      [delegate.id]: { shareEncryptionKey: ShareMetadataBehaviour.REQUIRED },
    })

    expect(result.notFoundIds).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [withKey.id!]: [delegate.id] })
    const error = singleError(result, withoutKey.id!, delegate.id)
    // Decided client-side, before any request is sent.
    expect(error.failureType).to.equal(FailedRequestDetailsFailureType.ResolutionFailed)
    expect(error.reason).to.contain('encryption key')
    expect(await hcpsWithAccessToHealthElement(sharer, withoutKey.id!)).to.not.contain(delegate.id)
  })

  it('fails only for the entity whose patient id the caller cannot access when it is REQUIRED', async function () {
    const patient = await newPatient(owner)
    const withPatientId = await newHealthElement(owner, patient, randomUUID())
    const withoutPatientId = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, withPatientId, {})
    await owner.api.healthcareElementApi.shareWith(sharer.id, withoutPatientId, { sharePatientId: ShareMetadataBehaviour.NEVER })

    const result = await sharer.api.healthcareElementApi.shareById([withPatientId.id!, withoutPatientId.id!], {
      [delegate.id]: { sharePatientId: ShareMetadataBehaviour.REQUIRED },
    })

    expect(result.notFoundIds).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [withPatientId.id!]: [delegate.id] })
    const error = singleError(result, withoutPatientId.id!, delegate.id)
    expect(error.failureType).to.equal(FailedRequestDetailsFailureType.ResolutionFailed)
    expect(error.reason).to.contain('owning entity id')
  })

  it('fails only for the entity without any accessible secret id when AllAvailable requires at least one', async function () {
    const patient = await newPatient(owner)
    const withSecretId = await newHealthElement(owner, patient, randomUUID())
    const withoutSecretId = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, withSecretId, {})
    await owner.api.healthcareElementApi.shareWith(sharer.id, withoutSecretId, { shareSecretIds: [] })
    expect(await accessibleSecretIdsOfHealthElement(sharer, withSecretId.id!)).to.have.length(1)
    expect(await accessibleSecretIdsOfHealthElement(sharer, withoutSecretId.id!)).to.be.empty

    const result = await sharer.api.healthcareElementApi.shareById([withSecretId.id!, withoutSecretId.id!], {
      [delegate.id]: { shareSecretIds: new SecretIdShareOptions.AllAvailable({ requireAtLeastOne: true }) },
    })

    expect(result.notFoundIds).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [withSecretId.id!]: [delegate.id] })
    const error = singleError(result, withoutSecretId.id!, delegate.id)
    expect(error.failureType).to.equal(FailedRequestDetailsFailureType.ResolutionFailed)
    expect(error.reason).to.contain('secret id')
  })

  it('shares no secret id, without failing, when AllAvailable does not require at least one', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, he, { shareSecretIds: [] })

    const result = await sharer.api.healthcareElementApi.shareById([he.id!], {
      [delegate.id]: { shareSecretIds: new SecretIdShareOptions.AllAvailable({}) },
    })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [he.id!]: [delegate.id] })
    expect(await accessibleSecretIdsOfHealthElement(delegate, he.id!)).to.be.empty
    // The rest of the metadata was shared all the same.
    expect((await delegate.api.healthcareElementApi.getHealthElementWithUser(delegate.user, he.id!)).note).to.equal(he.note)
  })

  it('fails when UseExactly lists an unknown secret id and createUnknownSecretIds is false', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, he, {})
    const unknownSecretId = randomUUID()

    const result = await sharer.api.healthcareElementApi.shareById([he.id!], {
      [delegate.id]: { shareSecretIds: new SecretIdShareOptions.UseExactly({ secretIds: [unknownSecretId], createUnknownSecretIds: false }) },
    })

    expect(result.successfulRequestsByEntityId).to.be.empty
    expect(result.unmodifiedDelegateIdsByEntityId).to.be.empty
    const error = singleError(result, he.id!, delegate.id)
    expect(error.failureType).to.equal(FailedRequestDetailsFailureType.ResolutionFailed)
    expect(error.reason).to.contain('createUnknownSecretIds is false')
    // The secret ids themselves are secrets: they must not be echoed back in a reason that callers log.
    expect(error.reason).to.not.contain(unknownSecretId)
    // Nothing was sent at all, so the delegate got no access whatsoever.
    expect(await hcpsWithAccessToHealthElement(sharer, he.id!)).to.not.contain(delegate.id)
  })

  it('shares exactly the secret ids UseExactly lists, creating the unknown ones when allowed', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, he, {})
    const sharerSecretIds = await accessibleSecretIdsOfHealthElement(sharer, he.id!)
    const newSecretId = randomUUID()
    expect(sharerSecretIds).to.not.contain(newSecretId)

    const result = await sharer.api.healthcareElementApi.shareById([he.id!], {
      [delegate.id]: { shareSecretIds: new SecretIdShareOptions.UseExactly({ secretIds: [newSecretId], createUnknownSecretIds: true }) },
    })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [he.id!]: [delegate.id] })
    // Exactly the requested one: the secret id the sharer itself knows is not shared.
    expect(await accessibleSecretIdsOfHealthElement(delegate, he.id!)).to.have.members([newSecretId])
  })

  it('reports a request the cloud rejects with its code, purpose and a non-sensitive summary of what was asked', async function () {
    const patient = await newPatient(owner)
    const writable = await newHealthElement(owner, patient, randomUUID())
    const readOnly = await newHealthElement(owner, patient, randomUUID())
    await owner.api.healthcareElementApi.shareWith(sharer.id, writable, { requestedPermissions: RequestedPermissionEnum.FULL_WRITE })
    await owner.api.healthcareElementApi.shareWith(sharer.id, readOnly, { requestedPermissions: RequestedPermissionEnum.FULL_READ })
    expect(
      await sharer.api.healthcareElementApi.hasWriteAccess(await sharer.api.healthcareElementApi.getHealthElementWithUser(sharer.user, readOnly.id!))
    ).to.be.false

    // The sharer, which itself only has read access to readOnly, cannot grant write access to it.
    const result = await sharer.api.healthcareElementApi.shareById([writable.id!, readOnly.id!], {
      [delegate.id]: { requestedPermissions: RequestedPermissionEnum.FULL_WRITE },
    })

    expect(requestedShares(result)).to.deep.equal({ [writable.id!]: [delegate.id] })
    const error = singleError(result, readOnly.id!, delegate.id)
    // Unlike the resolution failures above, this request was actually sent and the cloud rejected it.
    expect(error.failureType).to.equal(FailedRequestDetailsFailureType.RequestRejected)
    if (error.failureType !== FailedRequestDetailsFailureType.RequestRejected) throw new Error('unreachable')
    expect(error.purpose).to.equal(ShareRequestPurpose.RequestedShare)
    expect(error.code).to.be.a('number')
    const summary = error.requestSummary!
    expect(summary.requestedPermissions).to.equal(RequestedPermissionEnum.FULL_WRITE)
    expect(summary.secretIds.source).to.equal(SharedSecretIdsSource.AllAvailable)
    expect(summary.encryptionKeys.behaviour).to.equal(ShareMetadataBehaviour.IF_AVAILABLE)
    expect(summary.encryptionKeys.count).to.equal(1)
    expect(summary.owningEntityIds.behaviour).to.equal(ShareMetadataBehaviour.IF_AVAILABLE)
    expect(summary.owningEntityIds.count).to.equal(1)
    // The summary carries counts, never the metadata itself.
    expect(JSON.stringify(summary)).to.not.contain(patient.id!)
  })

  it('returns an empty result for an empty batch or an empty set of delegates', async function () {
    const patient = await newPatient(owner)
    const he = await newHealthElement(owner, patient, randomUUID())

    for (const result of [
      await owner.api.healthcareElementApi.shareById([], { [delegate.id]: {} }),
      await owner.api.healthcareElementApi.shareById([he.id!], {}),
    ]) {
      expect(result.notFoundIds).to.be.empty
      expect(result.successfulRequestsByEntityId).to.be.empty
      expect(result.unmodifiedDelegateIdsByEntityId).to.be.empty
      expect(result.shareErrors).to.be.empty
    }
  })

  it('shares contacts, including the id of the patient they refer to', async function () {
    const patient = await newPatient(owner)
    const descr = randomUUID()
    const contact = (await owner.api.contactApi.createContactWithUser(
      owner.user,
      await owner.api.contactApi.newInstance(owner.user, patient, { descr })
    ))!

    const result = await owner.api.contactApi.shareById([contact.id!], { [delegate.id]: {} })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [contact.id!]: [delegate.id] })
    const asDelegate = await delegate.api.contactApi.getContactWithUser(delegate.user, contact.id!)
    expect(asDelegate.descr).to.equal(descr)
    expect(await delegate.api.contactApi.decryptPatientIdOf(asDelegate)).to.have.members([patient.id!])
  })

  it('shares access logs', async function () {
    const patient = await newPatient(owner)
    const detail = randomUUID()
    const accessLog = await owner.api.accessLogApi.createAccessLogWithUser(
      owner.user,
      await owner.api.accessLogApi.newInstance(owner.user, patient, { detail })
    )

    const result = await owner.api.accessLogApi.shareById([accessLog.id!], { [delegate.id]: {} })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [accessLog.id!]: [delegate.id] })
    const asDelegate = await delegate.api.accessLogApi.getAccessLogWithUser(delegate.user, accessLog.id!)
    expect(asDelegate.detail).to.equal(detail)
  })

  it('shares patients', async function () {
    const note = randomUUID()
    const patient = await newPatient(owner, note)

    const result = await owner.api.patientApi.shareById([patient.id!], { [delegate.id]: {} })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [patient.id!]: [delegate.id] })
    const asDelegate = await delegate.api.patientApi.getPatientWithUser(delegate.user, patient.id!)
    expect(asDelegate.note).to.equal(note)
    expect(await delegate.api.patientApi.decryptSecretIdsOf(asDelegate)).to.have.members(await owner.api.patientApi.decryptSecretIdsOf(patient))
  })

  it('shares documents', async function () {
    const document = await owner.api.documentApi.createDocumentWithUser(
      owner.user,
      await owner.api.documentApi.newInstance(owner.user, undefined, { name: `doc-${randomUUID()}` })
    )

    const result = await owner.api.documentApi.shareById([document.id!], { [delegate.id]: {} })

    expect(result.shareErrors).to.be.empty
    expect(requestedShares(result)).to.deep.equal({ [document.id!]: [delegate.id] })
    const asDelegate = await delegate.api.documentApi.getDocumentWithUser(delegate.user, document.id!)
    expect(Object.keys((await delegate.api.documentApi.getDataOwnersWithAccessTo(asDelegate)).permissionsByDataOwnerId)).to.contain(delegate.id)
  })
})
