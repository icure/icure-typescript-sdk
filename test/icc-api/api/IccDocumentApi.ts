import { Api, IccDocumentXApi } from '../../../icc-x-api'
import { crypto } from '../../../node-compat'
import { Document } from '../../../icc-api/model/Document'
import { assert, expect } from 'chai'
import { randomBytes, randomUUID } from 'crypto'
import { XHR } from '../../../icc-api/api/XHR'
import XHRError = XHR.XHRError

const iCureUrl = process.env.ICURE_TS_TEST_URL ?? 'https://kraken.icure.dev/rest/v1'
const hcp1UserName = process.env.ICURE_TS_TEST_HCP_USER!
const hcp1Password = process.env.ICURE_TS_TEST_HCP_PWD!

const sampleKey = 'thumbnail'
const sampleKey2 = 'thumbnail2'
const sampleUti = ['uti2', 'uti1', 'uti3']
const sampleUti2 = ['uti4']

async function initialiseDocumentApi(): Promise<{ documentApi: IccDocumentXApi; document: Document }> {
  const { documentApi } = await Api(iCureUrl, hcp1UserName, hcp1Password, crypto)
  const document = await documentApi.createDocument(new Document({ id: randomUUID() }))
  return { documentApi, document }
}

function bufferEquals(buf1: ArrayBuffer, buf2: ArrayBuffer): Boolean {
  if (buf1.byteLength != buf2.byteLength) return false
  const dv1 = new Int8Array(buf1)
  const dv2 = new Int8Array(buf2)
  return arrayEquals(dv1, dv2)
}

function arrayEquals<T>(a1: ArrayLike<T>, a2: ArrayLike<T>): Boolean {
  if (a1.length != a2.length) return false
  for (let i = 0; i < a1.length; i++) {
    if (a1[i] != a2[i]) return false
  }
  return true
}

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

describe('Document api', () => {
  it('should allow to create and retrieve main attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data = randomBytes(32)
    const updated = await documentApi.setDocumentAttachment(document.id!, undefined, data)
    const retrievedData = await documentApi.getDocumentAttachment(document.id!, updated.attachmentId!)
    assert(bufferEquals(retrievedData, data))
  })

  it('should allow to create and retrieve secondary attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data = randomBytes(32)
    const updated = await documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, data)
    expect(updated.secondaryAttachments).to.contain.keys([sampleKey])
    assert(arrayEquals(updated.secondaryAttachments![sampleKey].utis!, []))
    const retrievedData = await documentApi.getSecondaryAttachment(document.id!, sampleKey)
    assert(bufferEquals(retrievedData, data))
  })

  it('should allow to initialise utis in secondary attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data = randomBytes(32)
    const updated = await documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, data, sampleUti)
    assert(arrayEquals(updated.secondaryAttachments![sampleKey].utis!, sampleUti))
  })

  it('should allow to update utis in secondary attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data = randomBytes(32)
    const updated = await documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, data)
    assert(arrayEquals(updated.secondaryAttachments![sampleKey].utis!, []))
    const updated2 = await documentApi.setSecondaryAttachment(document.id!, sampleKey, updated.rev!, data, sampleUti)
    assert(arrayEquals(updated2.secondaryAttachments![sampleKey].utis!, sampleUti))
  })

  it('should allow to delete secondary attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data = randomBytes(32)
    const updated = await documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, data)
    const originalAttachment = updated.secondaryAttachments![sampleKey]
    const timeBeforeDelete = Date.now()
    const deleted = await documentApi.deleteSecondaryAttachment(document.id!, sampleKey, updated.rev!)
    const timeAfterDelete = Date.now()
    expect(deleted.deletedAttachments).to.have.length(1)
    const deletedAttachment = deleted.deletedAttachments![0]
    expect(deletedAttachment.couchDbAttachmentId).to.equal(originalAttachment.couchDbAttachmentId)
    expect(deletedAttachment.objectStoreAttachmentId).to.equal(originalAttachment.objectStoreAttachmentId)
    expect(deletedAttachment.key).to.equal(sampleKey)
    expect(deletedAttachment.deletionTime).to.be.above(timeBeforeDelete).and.below(timeAfterDelete)
    expect(Object.keys(deleted.secondaryAttachments!)).to.be.empty
  })

  it('should treat secondary attachments with different keys as different attachments', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const data1 = randomBytes(32)
    const data2 = randomBytes(32)
    const data3 = randomBytes(32)
    assert(!bufferEquals(data1, data2))
    const updated1 = await documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, data1)
    const updated2 = await documentApi.setSecondaryAttachment(document.id!, sampleKey2, updated1.rev!, data2, sampleUti)
    expect(updated2.secondaryAttachments).to.have.keys([sampleKey, sampleKey2])
    assert(arrayEquals(updated2.secondaryAttachments![sampleKey].utis!, []))
    assert(arrayEquals(updated2.secondaryAttachments![sampleKey2].utis!, sampleUti))
    assert(bufferEquals(await documentApi.getSecondaryAttachment(document.id!, sampleKey), data1))
    assert(bufferEquals(await documentApi.getSecondaryAttachment(document.id!, sampleKey2), data2))
    const updated3 = await documentApi.setSecondaryAttachment(document.id!, sampleKey, updated2.rev!, data3, sampleUti2)
    expect(updated3.secondaryAttachments).to.have.keys([sampleKey, sampleKey2])
    assert(arrayEquals(updated3.secondaryAttachments![sampleKey].utis!, sampleUti2))
    assert(arrayEquals(updated3.secondaryAttachments![sampleKey2].utis!, sampleUti))
    assert(bufferEquals(await documentApi.getSecondaryAttachment(document.id!, sampleKey), data3))
    assert(bufferEquals(await documentApi.getSecondaryAttachment(document.id!, sampleKey2), data2))
    expect(updated3.deletedAttachments).to.have.length(1)
    const updated4 = await documentApi.deleteSecondaryAttachment(document.id!, sampleKey2, updated3.rev!)
    expect(updated4.secondaryAttachments).to.have.keys([sampleKey])
    expect(updated4.deletedAttachments).to.have.length(2)
    assert(bufferEquals(await documentApi.getSecondaryAttachment(document.id!, sampleKey), data3))
    await assertRequestFails(documentApi.getSecondaryAttachment(document.id!, sampleKey2), 404)
  })

  it('should refuse update methods which do not provide the latest rev', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    const updated = await documentApi.setDocumentAttachment(document.id!, undefined, randomBytes(32))
    await assertRequestFails(documentApi.setSecondaryAttachment(document.id!, sampleKey, document.rev!, randomBytes(32)), 409)
    await assertRequestFails(documentApi.deleteSecondaryAttachment(document.id!, sampleKey, document.rev!), 409)
  })

  it('should prevent using the document id as an attachment key', async () => {
    const { documentApi, document } = await initialiseDocumentApi()
    await assertRequestFails(documentApi.setSecondaryAttachment(document.id!, document.id!, document.rev!, randomBytes(32)), 400)
    await assertRequestFails(documentApi.deleteSecondaryAttachment(document.id!, document.id!, document.rev!), 400)
    await assertRequestFails(documentApi.getSecondaryAttachment(document.id!, document.id!, document.rev!), 400)
  })
})
