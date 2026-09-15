import { before, it } from 'mocha'

import 'isomorphic-fetch'

import { utf8_2ua } from '../../icc-x-api'
import { assert, expect } from 'chai'
import { randomBytes, randomUUID } from 'crypto'
import { createNewHcpApi, getEnvironmentInitializer, hcp1Username, setLocalStorage, TestUtils } from '../utils/test_utils'
import { getEnvVariables, TestVars } from '@icure/test-setup/types'
import initApi = TestUtils.initApi
import { IccDocumentApi } from '../../icc-api'

setLocalStorage(fetch)
let env: TestVars
const sampleKey = 'thumbnail'

async function assertRequestFails(request: Promise<any>, status: number) {
  let succeeded = false
  try {
    await request
    succeeded = true
  } catch (e: any) {
    expect(e.statusCode).to.equal(status)
  }
  assert(!succeeded, 'Request should have not succeeded')
}

before(async function () {
  this.timeout(600000)
  const initializer = await getEnvironmentInitializer()
  env = await initializer.execute(getEnvVariables())
})

describe('icc-x-document-api Tests', () => {
  it('Get and decrypt as json should work', async () => {
    // Given
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const obj = { test: 'test' }
    await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua(JSON.stringify(obj)))
    const decrypted = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'application/json')
    expect(decrypted).to.deep.equal(obj)
  })

  it('Get and decrypt as string should work', async () => {
    // Given
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const obj = 'Test'
    await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua(obj))
    const decrypted = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'text/plain')
    expect(decrypted).to.deep.equal(obj)
    const decryptedAsJson = await documentApi.getAndTryDecryptMainAttachmentAs(document, 'application/json')
    expect(decryptedAsJson).to.be.undefined
  })

  it('Should be encrypted', async () => {
    const hcp = await createNewHcpApi(env, {
      encryptedFieldsConfig: {
        document: ['name'],
      },
    })
    const name = 'Private.txt'
    const externalUuid = randomUUID()
    const created = await hcp.api.documentApi.createDocumentWithUser(
      undefined,
      await hcp.api.documentApi.newInstance(hcp.user, undefined, {
        id: randomUUID(),
        name,
        externalUuid,
      })
    )
    expect(created.name).to.eq(name)
    expect(created.externalUuid).to.eq(externalUuid)
    const retrieved = await hcp.api.documentApi.getDocumentWithUser(undefined, created.id!)
    expect(retrieved.name).to.eq(name)
    expect(retrieved.externalUuid).to.eq(externalUuid)
    const encrypted = await new IccDocumentApi(env.iCureUrl, {}, hcp.api.authApi.authenticationProvider, fetch).getDocument(created.id!)
    expect(encrypted.name).to.be.undefined
    expect(encrypted.externalUuid).to.eq(externalUuid)
  })

  it('Should allow to delete a main attachment', async () => {
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const updated = await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua('Test'))
    expect(updated.mainAttachmentStoredDataSize).to.be.equal(32)

    const timeBeforeDelete = Date.now() - 100
    const deleted = await documentApi.deleteAttachmentWithUser(undefined, document.id!, updated.rev!)
    const timeAfterDelete = Date.now() + 100

    expect(deleted.deletedAttachments).to.have.length(1)
    expect(deleted.deletedAttachments![0].deletionTime).to.be.above(timeBeforeDelete).and.below(timeAfterDelete)
    expect(deleted.mainUti).to.be.undefined
    expect(deleted.otherUtis ?? []).to.be.empty

    await assertRequestFails(documentApi.getAndTryDecryptMainAttachmentAs(deleted, 'text/plain'), 404)
  })

  it('Should fail to delete a main attachment with a stale rev', async () => {
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const updated = await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua('Test'))

    const modified = await documentApi.modifyDocumentWithUser(undefined, { ...updated, name: 'new name' })
    expect(modified.rev).to.not.equal(updated.rev)

    await assertRequestFails(documentApi.deleteAttachmentWithUser(undefined, document.id!, updated.rev!), 409)
  })

  it('Should allow to set a new main attachment after deleting the previous one', async () => {
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const updated = await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua('First'))
    const deleted = await documentApi.deleteAttachmentWithUser(undefined, document.id!, updated.rev!)

    const recreated = await documentApi.encryptAndSetDocumentAttachment(deleted, utf8_2ua('Second'))
    const decrypted = await documentApi.getAndTryDecryptMainAttachmentAs(recreated, 'text/plain')
    expect(decrypted).to.deep.equal('Second')
  })

  it('Should not affect secondary attachments when deleting the main attachment', async () => {
    const { documentApi, userApi } = await initApi(env!, hcp1Username)

    const currUser = await userApi.getCurrentUser()
    const document = await documentApi.createDocumentWithUser(undefined, await documentApi.newInstance(currUser, undefined, {}))
    const withMain = await documentApi.encryptAndSetDocumentAttachment(document, utf8_2ua('Main content'))
    const secondaryData = randomBytes(32)
    const withSecondary = await documentApi.setSecondaryAttachmentWithUser(undefined, document.id!, sampleKey, withMain.rev!, secondaryData)

    const deleted = await documentApi.deleteAttachmentWithUser(undefined, document.id!, withSecondary.rev!)

    expect(deleted.secondaryAttachments).to.contain.keys([sampleKey])
    const retrievedSecondary = new Uint8Array(await documentApi.getSecondaryAttachment(document.id!, sampleKey))
    expect(Buffer.compare(Buffer.from(retrievedSecondary), secondaryData)).to.equal(0)
    await assertRequestFails(documentApi.getAndTryDecryptMainAttachmentAs(deleted, 'text/plain'), 404)
  })
})
