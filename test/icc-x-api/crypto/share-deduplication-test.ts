import { createNewHcpApi, getEnvironmentInitializer, setLocalStorage, TestUtils } from '../../utils/test_utils'
import { randomUUID, webcrypto } from 'crypto'
import { expect } from 'chai'
import 'isomorphic-fetch'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import { IcureApi, ShaVersion } from '../../../icc-x-api'
import { User } from '../../../icc-api/model/User'
import { testStorageWithKeys } from '../../utils/TestStorage'
import { TestCryptoStrategies } from '../../utils/TestCryptoStrategies'
import { EntityShareRequest } from '../../../icc-api/model/requests/EntityShareRequest'
import initMasterApi = TestUtils.initMasterApi
import RequestedPermissionEnum = EntityShareRequest.RequestedPermissionEnum

setLocalStorage(fetch)

let env: TestVars

/**
 * Creates a fresh hcp (random keypair) and makes it a child of parentId, to establish the existing
 * relationship that operations such as mergePatients require between data owners in order to
 * authorize the operation (an entirely unrelated hcp gets a 403).
 *
 * By default this does NOT give the child a locally-held copy of the parent's key
 * (disableParentKeysInitialisation skips the startup check that would otherwise require one): in
 * tests where we only care about the authorization relationship, we don't want the child to also
 * be able to reach anything shared with the parent through a locally-cached parent key, which
 * would muddy visibility assertions.
 * Pass parentKeys for tests that specifically want to exercise genuine hierarchical inheritance (a
 * child that has actually verified/cached its parent's key, like a properly provisioned device in
 * the same care organisation).
 */
async function createChildOfParent(
  testSetupApi: IcureApi,
  parentId: string,
  parentKeys?: { privateKey: string; publicKey: string }
): Promise<{ api: IcureApi; user: User; id: string }> {
  const info = await createNewHcpApi(env)
  await testSetupApi.healthcarePartyApi.modifyHealthcareParty({
    ...(await testSetupApi.healthcarePartyApi.getHealthcareParty(info.credentials.dataOwnerId)),
    parentId,
  })
  const storage = await testStorageWithKeys([
    {
      dataOwnerId: info.credentials.dataOwnerId,
      pairs: [{ keyPair: { privateKey: info.credentials.privateKey, publicKey: info.credentials.publicKey }, shaVersion: ShaVersion.Sha1 }],
    },
    ...(parentKeys ? [{ dataOwnerId: parentId, pairs: [{ keyPair: parentKeys, shaVersion: ShaVersion.Sha1 }] }] : []),
  ])
  const api = await IcureApi.initialise(
    env.iCureUrl,
    { username: info.credentials.user, password: info.credentials.password },
    new TestCryptoStrategies(),
    webcrypto as any,
    fetch,
    { storage: storage.storage, keyStorage: storage.keyStorage, entryKeysFactory: storage.keyFactory, disableParentKeysInitialisation: !parentKeys }
  )
  const user = await api.userApi.getCurrentUser()
  return { api, user, id: info.credentials.dataOwnerId }
}

/*
 * shareWith/shareWithMany should skip writing a delegation only when the target already has DIRECT access -
 * named as either party of a specific, already-decryptable-by-the-caller delegation edge - never inferred via
 * hierarchy, and never conflating content coverage with permission sufficiency (the two are independent: the
 * backend only checks "is there at least one delegation naming this data owner with write access", it never
 * correlates that with which specific secret id/encryption key a delegation happens to carry).
 */
describe('shareWith/shareWithMany only skip writes when the delegate has genuinely direct, decryptable access', function () {
  before(async function () {
    this.timeout(600000)
    const initializer = await getEnvironmentInitializer()
    env = await initializer.execute(getEnvVariables())
  })

  it('still writes when an unrelated third party X (who was separately given access by A) tries to reshare with P, since X cannot decrypt the A->P delegation', async function () {
    const aInfo = await createNewHcpApi(env)
    const pInfo = await createNewHcpApi(env)
    const xInfo = await createNewHcpApi(env)

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedWithP = await aInfo.api.patientApi.shareWithMany(created, {
      [pInfo.credentials.dataOwnerId]: { shareSecretIds: [secretId] },
    })
    const sharedWithX = await aInfo.api.patientApi.shareWithMany(sharedWithP, {
      [xInfo.credentials.dataOwnerId]: { shareSecretIds: [secretId] },
    })

    const freshForX = await xInfo.api.patientApi.getPatientWithUser(xInfo.user, sharedWithX.id!)
    const reshared = await xInfo.api.patientApi.shareWith(pInfo.credentials.dataOwnerId, freshForX, [secretId])
    expect(reshared.rev).to.not.equal(freshForX.rev)
  })

  it('still shares directly with B even though P (a shared parent that already has the content, and B is a child of) already has it', async function () {
    const testSetupApi = await initMasterApi(env)
    const pInfo = await createNewHcpApi(env)
    const pId = pInfo.credentials.dataOwnerId
    const aInfo = await createChildOfParent(testSetupApi, pId)
    const bInfo = await createChildOfParent(testSetupApi, pId)

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedWithP = await aInfo.api.patientApi.shareWithMany(created, { [pId]: { shareSecretIds: [secretId] } })

    const freshForA = await aInfo.api.patientApi.getPatientWithUser(aInfo.user, sharedWithP.id!)
    const sharedWithB = await aInfo.api.patientApi.shareWith(bInfo.id, freshForA, [secretId])
    expect(sharedWithB.rev).to.not.equal(freshForA.rev)
    expect(await bInfo.api.patientApi.decryptSecretIdsOf(await bInfo.api.patientApi.getPatientWithUser(bInfo.user, sharedWithB.id!))).to.have.members(
      [secretId]
    )
  })

  it('still writes when A shares directly with Y, even though only an unrelated X->Y delegation (which A cannot decrypt) already covers it', async function () {
    const aInfo = await createNewHcpApi(env)
    const xInfo = await createNewHcpApi(env)
    const yInfo = await createNewHcpApi(env)

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedWithX = await aInfo.api.patientApi.shareWithMany(created, {
      [xInfo.credentials.dataOwnerId]: { shareSecretIds: [secretId] },
    })

    const freshForX = await xInfo.api.patientApi.getPatientWithUser(xInfo.user, sharedWithX.id!)
    const sharedWithY = await xInfo.api.patientApi.shareWithMany(freshForX, {
      [yInfo.credentials.dataOwnerId]: { shareSecretIds: [secretId] },
    })

    const freshForA = await aInfo.api.patientApi.getPatientWithUser(aInfo.user, sharedWithY.id!)
    const aSharesWithY = await aInfo.api.patientApi.shareWith(yInfo.credentials.dataOwnerId, freshForA, [secretId])
    expect(aSharesWithY.rev).to.not.equal(freshForA.rev)
  })

  it('is a no-op when B shares content back with A, since A->B delegations are symmetric and A can decrypt its own', async function () {
    const aInfo = await createNewHcpApi(env)
    const bInfo = await createNewHcpApi(env)

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedWithB = await aInfo.api.patientApi.shareWithMany(created, {
      [bInfo.credentials.dataOwnerId]: { shareSecretIds: [secretId] },
    })

    const freshForB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, sharedWithB.id!)
    const bSharesBackWithA = await bInfo.api.patientApi.shareWith(aInfo.credentials.dataOwnerId, freshForB, [secretId])
    expect(bSharesBackWithA.rev).to.equal(freshForB.rev)
  })

  it('still writes a permission-only grant when the delegate already has the content, but only at an insufficient permission level', async function () {
    const testSetupApi = await initMasterApi(env)
    const pInfo = await createNewHcpApi(env)
    const pId = pInfo.credentials.dataOwnerId
    const aInfo = await createChildOfParent(testSetupApi, pId)
    // B genuinely holds P's key (like a properly provisioned device), so it can verify P's existing coverage
    // directly rather than relying on any hierarchy inference. B also needs its own, real write-level delegation
    // on the entity (from A) - merely being able to decrypt via a borrowed key is not enough for the backend to
    // authorize B to grant permissions to someone else; B must have genuine recorded access of its own too.
    const bInfo = await createChildOfParent(testSetupApi, pId, {
      privateKey: pInfo.credentials.privateKey,
      publicKey: pInfo.credentials.publicKey,
    })

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedReadOnly = await aInfo.api.patientApi.shareWith(pId, created, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    })
    expect(await pInfo.api.patientApi.hasWriteAccess(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, sharedReadOnly.id!))).to.be.false
    const sharedWithB = await aInfo.api.patientApi.shareWithMany(sharedReadOnly, { [bInfo.id]: { shareSecretIds: [secretId] } })

    const freshForB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, sharedWithB.id!)
    const upgraded = await bInfo.api.patientApi.shareWith(pId, freshForB, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_WRITE,
    })
    expect(upgraded.rev).to.not.equal(freshForB.rev)
    expect(await pInfo.api.patientApi.hasWriteAccess(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, upgraded.id!))).to.be.true
  })

  it('is a no-op when the delegate already has the content at a sufficient permission level, verified via a different, unrelated caller', async function () {
    const testSetupApi = await initMasterApi(env)
    const pInfo = await createNewHcpApi(env)
    const pId = pInfo.credentials.dataOwnerId
    const aInfo = await createChildOfParent(testSetupApi, pId)
    const parentKeys = { privateKey: pInfo.credentials.privateKey, publicKey: pInfo.credentials.publicKey }
    const bInfo = await createChildOfParent(testSetupApi, pId, parentKeys)
    const cInfo = await createChildOfParent(testSetupApi, pId, parentKeys)

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedReadOnly = await aInfo.api.patientApi.shareWith(pId, created, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    })
    // B and C each need their own real write-level delegation on the entity (from A) to be authorized to grant
    // permissions to someone else - merely holding P's key for decryption purposes is not enough on its own.
    const sharedWithBAndC = await aInfo.api.patientApi.shareWithMany(sharedReadOnly, {
      [bInfo.id]: { shareSecretIds: [secretId] },
      [cInfo.id]: { shareSecretIds: [secretId] },
    })
    const freshForB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, sharedWithBAndC.id!)
    const upgraded = await bInfo.api.patientApi.shareWith(pId, freshForB, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_WRITE,
    })

    // C never shared anything with P itself, but (via P's key) can verify P already has the content at a
    // sufficient (WRITE) permission now - requesting only FULL_READ should be a true no-op.
    const freshForC = await cInfo.api.patientApi.getPatientWithUser(cInfo.user, upgraded.id!)
    const reshared = await cInfo.api.patientApi.shareWith(pId, freshForC, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    })
    expect(reshared.rev).to.equal(freshForC.rev)
  })

  it('is a no-op when re-sharing at the default MAX_WRITE permission would only resolve to READ anyway, since the caller granting it has no write access itself', async function () {
    const testSetupApi = await initMasterApi(env)
    const pInfo = await createNewHcpApi(env)
    const pId = pInfo.credentials.dataOwnerId
    const aInfo = await createChildOfParent(testSetupApi, pId)
    // X genuinely holds P's key, so it can verify P's existing coverage directly, and only ever gets FULL_READ
    // access itself from A - MAX_WRITE resolves to "WRITE if the caller granting it has WRITE, else READ", so a
    // MAX_WRITE request from X could never exceed READ, matching what P already has: nothing would change.
    const xInfo = await createChildOfParent(testSetupApi, pId, { privateKey: pInfo.credentials.privateKey, publicKey: pInfo.credentials.publicKey })

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedWithP = await aInfo.api.patientApi.shareWith(pId, created, [secretId], { requestedPermissions: RequestedPermissionEnum.FULL_READ })
    const sharedWithX = await aInfo.api.patientApi.shareWith(xInfo.id, sharedWithP, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    })

    const freshForX = await xInfo.api.patientApi.getPatientWithUser(xInfo.user, sharedWithX.id!)
    const reshared = await xInfo.api.patientApi.shareWith(pId, freshForX, [secretId]) // default requestedPermissions: MAX_WRITE
    expect(reshared.rev).to.equal(freshForX.rev)
  })

  it('still upgrades the delegate to WRITE via the default MAX_WRITE permission when the caller granting it genuinely has write access, even though the delegate already has READ', async function () {
    const testSetupApi = await initMasterApi(env)
    const pInfo = await createNewHcpApi(env)
    const pId = pInfo.credentials.dataOwnerId
    const aInfo = await createChildOfParent(testSetupApi, pId)
    // B genuinely holds P's key (so it can verify P's existing READ coverage directly) and gets its own real
    // WRITE-level delegation from A (the default MAX_WRITE, since A itself has full write access). B has never
    // shared anything with P before, so its re-share below creates a brand new delegation rather than updating an
    // existing one - unlike a same-caller re-share, a new delegation's permissions aren't limited to a content diff.
    const bInfo = await createChildOfParent(testSetupApi, pId, {
      privateKey: pInfo.credentials.privateKey,
      publicKey: pInfo.credentials.publicKey,
    })

    const created = await aInfo.api.patientApi.createPatientWithUser(
      aInfo.user,
      await aInfo.api.patientApi.newInstance(aInfo.user, { firstName: 'John', lastName: 'Doe' })
    )
    const secretId = (await aInfo.api.patientApi.decryptSecretIdsOf(created))[0]
    const sharedReadOnly = await aInfo.api.patientApi.shareWith(pId, created, [secretId], {
      requestedPermissions: RequestedPermissionEnum.FULL_READ,
    })
    expect(await pInfo.api.patientApi.hasWriteAccess(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, sharedReadOnly.id!))).to.be.false
    const sharedWithB = await aInfo.api.patientApi.shareWithMany(sharedReadOnly, { [bInfo.id]: { shareSecretIds: [secretId] } })

    // B (fresh caller for P, genuinely has WRITE) re-shares at the default MAX_WRITE - resolves to WRITE, a real
    // upgrade over P's existing READ, even though the content itself is already fully covered.
    const freshForB = await bInfo.api.patientApi.getPatientWithUser(bInfo.user, sharedWithB.id!)
    const upgraded = await bInfo.api.patientApi.shareWith(pId, freshForB, [secretId])
    expect(upgraded.rev).to.not.equal(freshForB.rev)
    expect(await pInfo.api.patientApi.hasWriteAccess(await pInfo.api.patientApi.getPatientWithUser(pInfo.user, upgraded.id!))).to.be.true
  })
})
