import type { IccReceiptXApi, Receipt } from '@icure/api'
import { classifyPayload, type PayloadFormat, preview } from './validate'

export type AttachmentOutcome =
  /** Decrypted and the payload is a valid XML or JSON document. */
  | 'ok'
  /** Decrypted but the payload is neither valid XML nor valid JSON. */
  | 'bad-payload'
  /** The attachment could be downloaded but no available key could decrypt it. */
  | 'decrypt-failed'
  /** The attachment could not even be downloaded (http error, missing blob, failed decompression). */
  | 'download-failed'

export interface AttachmentReport {
  blobType: string
  /** Which endpoint served the bytes: the compression-aware data attachment, or the legacy attachment. */
  via: 'dataAttachment' | 'legacyAttachment'
  fellBackFrom?: 'dataAttachment' | 'legacyAttachment'
  outcome: AttachmentOutcome
  /** Whether a key of the data owner hierarchy was actually used to decrypt the bytes. */
  decrypted?: boolean
  /** True when the receipt is encrypted but this attachment was stored in clear, and the payload is still valid. */
  storedInClear?: boolean
  format?: PayloadFormat
  detail?: string
  sniffed?: string
  preview?: string
  byteLength?: number
  compressionAlgorithm?: string
  utis?: string[]
  storedDataSize?: number
  realDataSize?: number
  error?: string
}

export type ReceiptOutcome = 'ok' | 'no-attachment' | 'problem'

export interface ReceiptReport {
  id: string
  rev?: string
  created?: number
  createdIso?: string
  category?: string
  subCategory?: string
  documentId?: string
  references?: string[]
  /** False when the receipt carries no encryption metadata at all: its attachments are legitimately in clear. */
  hasEncryptionMetadata: boolean
  outcome: ReceiptOutcome
  attachments: AttachmentReport[]
  error?: string
}

function hasEncryptionMetadata(receipt: Receipt): boolean {
  return Object.keys(receipt.encryptionKeys ?? {}).length > 0 || Object.keys(receipt.securityMetadata?.secureDelegations ?? {}).length > 0
}

/** Every blob type the receipt declares, on the data-attachment side, on the legacy side, or on both. */
function blobTypesOf(receipt: Receipt): string[] {
  return [...new Set([...Object.keys(receipt.attachmentInfos ?? {}), ...Object.keys(receipt.attachmentIds ?? {})])].sort()
}

async function scanAttachment(receiptApi: IccReceiptXApi, receipt: Receipt, blobType: string): Promise<AttachmentReport> {
  const info = receipt.attachmentInfos?.[blobType]
  const legacyAttachmentId = receipt.attachmentIds?.[blobType]
  const base: AttachmentReport = {
    blobType,
    via: info ? 'dataAttachment' : 'legacyAttachment',
    outcome: 'download-failed',
    compressionAlgorithm: info?.compressionAlgorithm,
    utis: info?.utis,
    storedDataSize: info?.storedDataSize,
    realDataSize: info?.realDataSize,
  }

  // Prefer the data-attachment endpoint when the receipt declares attachment infos, since only that path knows how to
  // decompress. Fall back to the other endpoint when the preferred one fails and the receipt declares both.
  const attempts: { via: 'dataAttachment' | 'legacyAttachment'; run: () => Promise<{ data: ArrayBuffer; wasDecrypted: boolean }> }[] = []
  if (info) attempts.push({ via: 'dataAttachment', run: () => receiptApi.getAndTryDecryptReceiptDataAttachment(receipt, blobType) })
  if (legacyAttachmentId) {
    attempts.push({ via: 'legacyAttachment', run: () => receiptApi.getAndTryDecryptReceiptAttachment(receipt, legacyAttachmentId) })
  }
  if (attempts.length === 0) {
    return { ...base, error: `blob type '${blobType}' has neither attachment infos nor a legacy attachment id` }
  }

  const errors: string[] = []
  for (const [index, attempt] of attempts.entries()) {
    let retrieved: { data: ArrayBuffer; wasDecrypted: boolean }
    try {
      retrieved = await attempt.run()
    } catch (e) {
      errors.push(`${attempt.via}: ${(e as Error).message ?? String(e)}`)
      continue
    }

    const result: AttachmentReport = {
      ...base,
      via: attempt.via,
      fellBackFrom: index > 0 ? attempts[0].via : undefined,
      byteLength: retrieved.data.byteLength,
    }

    // The payload is classified even when no key could be used: an attachment of an encrypted receipt that was
    // uploaded in clear decrypts to nothing but still holds a perfectly valid document, and telling that apart from
    // undecryptable garbage is the whole point of the scan.
    const verdict = classifyPayload(retrieved.data)
    const isClearOnEncryptedReceipt = !retrieved.wasDecrypted && hasEncryptionMetadata(receipt)
    const classified: AttachmentReport = {
      ...result,
      decrypted: retrieved.wasDecrypted,
      format: verdict.format,
      detail: verdict.detail,
      sniffed: verdict.sniffed,
      preview: verdict.preview,
      outcome: verdict.format === 'unrecognised' ? 'bad-payload' : 'ok',
    }

    if (!isClearOnEncryptedReceipt) return classified
    return verdict.format === 'unrecognised'
      ? {
          ...classified,
          outcome: 'decrypt-failed',
          detail: `no available key could decrypt the attachment, and the raw bytes are not a document either (${verdict.detail})`,
          preview: verdict.preview ?? preview(new Uint8Array(retrieved.data)),
        }
      : { ...classified, storedInClear: true, detail: `${verdict.detail}, but stored in clear on an encrypted receipt` }
  }

  return { ...base, error: errors.join(' / ') }
}

/** Downloads, decrypts and classifies every attachment of one receipt. Never throws. */
export async function scanReceipt(receiptApi: IccReceiptXApi, receipt: Receipt): Promise<ReceiptReport> {
  const report: ReceiptReport = {
    id: receipt.id!,
    rev: receipt.rev,
    created: receipt.created,
    createdIso: receipt.created ? new Date(receipt.created).toISOString() : undefined,
    category: receipt.category,
    subCategory: receipt.subCategory,
    documentId: receipt.documentId,
    references: receipt.references,
    hasEncryptionMetadata: hasEncryptionMetadata(receipt),
    outcome: 'no-attachment',
    attachments: [],
  }

  try {
    const blobTypes = blobTypesOf(receipt)
    if (blobTypes.length === 0) return report
    for (const blobType of blobTypes) {
      report.attachments.push(await scanAttachment(receiptApi, receipt, blobType))
    }
    report.outcome = report.attachments.every((it) => it.outcome === 'ok') ? 'ok' : 'problem'
  } catch (e) {
    report.outcome = 'problem'
    report.error = (e as Error).message ?? String(e)
  }
  return report
}
