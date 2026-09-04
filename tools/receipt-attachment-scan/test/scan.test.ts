import { describe, expect, it } from 'bun:test'
import { type IccReceiptXApi, Receipt } from '@icure/api'
import { scanReceipt } from '../src/scan'

const buffer = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer

type Retrieved = { data: ArrayBuffer; wasDecrypted: boolean }

/** Minimal stand-in for the receipt api: only the two download-and-decrypt methods the scan uses. */
function fakeApi(handlers: {
  dataAttachment?: (blobType: string) => Promise<Retrieved>
  legacyAttachment?: (attachmentId: string) => Promise<Retrieved>
}): IccReceiptXApi {
  return {
    getAndTryDecryptReceiptDataAttachment: (_receipt: Receipt, blobType: string) =>
      handlers.dataAttachment?.(blobType) ?? Promise.reject(new Error('no data attachment endpoint')),
    getAndTryDecryptReceiptAttachment: (_receipt: Receipt, attachmentId: string) =>
      handlers.legacyAttachment?.(attachmentId) ?? Promise.reject(new Error('no legacy attachment endpoint')),
  } as unknown as IccReceiptXApi
}

const encryptedReceipt = (extra: Partial<Receipt> = {}) =>
  new Receipt({ id: 'r1', created: 1_700_000_000_000, encryptionKeys: { 'hcp-1': [{ key: 'k' }] }, ...extra } as never)

describe('scanReceipt', () => {
  it('reports a receipt without any attachment as such', async () => {
    const report = await scanReceipt(fakeApi({}), encryptedReceipt())
    expect(report.outcome).toBe('no-attachment')
    expect(report.attachments).toHaveLength(0)
  })

  it('accepts a decrypted, valid xml data attachment', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: { utis: ['public.xml'], storedDataSize: 12 } } } as never)
    const report = await scanReceipt(fakeApi({ dataAttachment: async () => ({ data: buffer('<a/>'), wasDecrypted: true }) }), receipt)
    expect(report.outcome).toBe('ok')
    expect(report.attachments[0]).toMatchObject({ blobType: 'tack', via: 'dataAttachment', outcome: 'ok', format: 'xml', decrypted: true })
  })

  it('flags a decrypted attachment whose payload is neither xml nor json', async () => {
    const receipt = encryptedReceipt({ attachmentIds: { tack: 'att-1' } } as never)
    const report = await scanReceipt(fakeApi({ legacyAttachment: async () => ({ data: buffer('{"a":1'), wasDecrypted: true }) }), receipt)
    expect(report.outcome).toBe('problem')
    expect(report.attachments[0]).toMatchObject({ via: 'legacyAttachment', outcome: 'bad-payload', format: 'unrecognised' })
  })

  it('reports a decryption failure only when the raw bytes are not a document either', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: {} } } as never)
    const report = await scanReceipt(
      fakeApi({ dataAttachment: async () => ({ data: new Uint8Array([0x1f, 0x8b, 0x08]).buffer as ArrayBuffer, wasDecrypted: false }) }),
      receipt
    )
    expect(report.attachments[0]).toMatchObject({ outcome: 'decrypt-failed', decrypted: false, sniffed: 'gzip' })
  })

  it('accepts a valid payload stored in clear on an encrypted receipt, and says so', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: {} } } as never)
    const report = await scanReceipt(fakeApi({ dataAttachment: async () => ({ data: buffer('<a/>'), wasDecrypted: false }) }), receipt)
    expect(report.outcome).toBe('ok')
    expect(report.attachments[0]).toMatchObject({ outcome: 'ok', format: 'xml', decrypted: false, storedInClear: true })
  })

  it('does not flag a clear attachment of a receipt that has no encryption metadata', async () => {
    const receipt = new Receipt({ id: 'r2', attachmentInfos: { tack: {} } } as never)
    const report = await scanReceipt(fakeApi({ dataAttachment: async () => ({ data: buffer('[1]'), wasDecrypted: false }) }), receipt)
    expect(report.attachments[0]).toMatchObject({ outcome: 'ok', format: 'json' })
    expect(report.attachments[0].storedInClear).toBeUndefined()
  })

  it('falls back to the legacy endpoint when the data attachment one fails, and records the fallback', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: {} }, attachmentIds: { tack: 'att-1' } } as never)
    const report = await scanReceipt(
      fakeApi({
        dataAttachment: async () => {
          throw new Error('404 not found')
        },
        legacyAttachment: async () => ({ data: buffer('<a/>'), wasDecrypted: true }),
      }),
      receipt
    )
    expect(report.outcome).toBe('ok')
    expect(report.attachments[0]).toMatchObject({ via: 'legacyAttachment', fellBackFrom: 'dataAttachment', outcome: 'ok' })
  })

  it('reports a download failure with every attempt error when no endpoint works', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: {} }, attachmentIds: { tack: 'att-1' } } as never)
    const report = await scanReceipt(
      fakeApi({
        dataAttachment: async () => {
          throw new Error('boom data')
        },
        legacyAttachment: async () => {
          throw new Error('boom legacy')
        },
      }),
      receipt
    )
    expect(report.outcome).toBe('problem')
    expect(report.attachments[0].outcome).toBe('download-failed')
    expect(report.attachments[0].error).toContain('boom data')
    expect(report.attachments[0].error).toContain('boom legacy')
  })

  it('scans every blob type of a receipt', async () => {
    const receipt = encryptedReceipt({ attachmentInfos: { tack: {}, invoice: {} } } as never)
    const report = await scanReceipt(
      fakeApi({ dataAttachment: async (blobType) => ({ data: buffer(blobType === 'tack' ? '<a/>' : 'nope'), wasDecrypted: true }) }),
      receipt
    )
    expect(report.attachments.map((it) => it.blobType)).toEqual(['invoice', 'tack'])
    expect(report.outcome).toBe('problem')
  })
})
