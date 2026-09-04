import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IccAuthApi, IcureApi, NoAuthenticationProvider, type Receipt } from '@icure/api'
import { type Options, parseArgs } from './args'
import { loadPrivateKeys } from './keys'
import { enumerateReceiptsByCreationDate } from './receipts'
import { scanReceipt, type ReceiptReport } from './scan'
import { InMemoryKeyStorage, InMemoryStorage } from './storage'
import { ScannerCryptoStrategies } from './strategies'

/** Runs `worker` over `items` with at most `concurrency` in flight, preserving the input order in the result. */
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = next++
        if (index >= items.length) return
        results[index] = await worker(items[index])
      }
    })
  )
  return results
}

function logReceipt(report: ReceiptReport, options: Options) {
  if (report.outcome === 'ok' || report.outcome === 'no-attachment') {
    if (!options.verbose) return
    const formats = report.attachments.map((it) => `${it.blobType}=${it.format}`).join(' ')
    console.log(`  ok        ${report.id}  ${report.outcome === 'no-attachment' ? '(no attachment)' : formats}`)
    return
  }
  console.log(`  PROBLEM   ${report.id}  created=${report.createdIso ?? 'unknown'}`)
  if (report.error) console.log(`              ${report.error}`)
  for (const attachment of report.attachments.filter((it) => it.outcome !== 'ok')) {
    console.log(`              [${attachment.blobType}] ${attachment.outcome} via ${attachment.via}: ${attachment.detail ?? attachment.error}`)
    if (attachment.sniffed) console.log(`              the bytes look like ${attachment.sniffed}`)
    if (attachment.preview) console.log(`              ${attachment.preview}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const crypto = globalThis.crypto
  const fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response> = fetch

  const keys = await loadPrivateKeys(options.keyPaths, crypto)
  console.log(`Loaded ${keys.length} private key(s):`)
  keys.forEach((key) => console.log(`  ${key.publicKeySpkiHex.slice(-32)}  ${key.source}`))

  // The refresh token is exchanged for an auth token up front: the api needs a valid auth token to resolve the group
  // the user is working on before any request is made.
  const authApi = new IccAuthApi(options.host, {}, new NoAuthenticationProvider(), fetchImpl)
  const tokens = await authApi.refreshAuthenticationJWT(options.refreshToken)
  if (!tokens.token || !tokens.refreshToken) throw new Error('The backend did not return a token pair: the refresh token is probably expired')

  const strategies = new ScannerCryptoStrategies(keys)
  const api = await IcureApi.initialise(
    options.host,
    { icureTokens: { token: tokens.token, refreshToken: tokens.refreshToken } },
    strategies,
    crypto,
    fetchImpl,
    { storage: new InMemoryStorage(), keyStorage: new InMemoryKeyStorage(), createMaintenanceTasksOnNewKey: false }
  )

  const user = await api.userApi.getCurrentUser()
  const self = await api.dataOwnerApi.getCurrentDataOwner()
  console.log(`Authenticated as ${user.login ?? user.id} (data owner ${self.dataOwner.id}, type ${self.type})`)
  for (const [publicKey, attribution] of strategies.attributedKeys) {
    console.log(`  key ${publicKey.slice(-32)} -> data owner ${attribution.dataOwnerId} (${attribution.shaVersion})`)
  }
  for (const unused of strategies.unusedKeys()) {
    console.warn(`  Warning: no data owner of the hierarchy declares the key from ${unused.source}; it will not be used.`)
  }

  const receiptApi = api.receiptApi
  const reports: ReceiptReport[] = []
  const seen = new Set<string>()
  let reachedLimit = false

  const processBatch = async (batch: Receipt[]) => {
    const fresh = batch.filter((receipt) => {
      if (!receipt.id || seen.has(receipt.id)) return false
      seen.add(receipt.id)
      return true
    })
    const remaining = options.limit === undefined ? fresh : fresh.slice(0, Math.max(0, options.limit - reports.length))
    const batchReports = await mapWithConcurrency(remaining, options.concurrency, (receipt) => scanReceipt(receiptApi, receipt))
    batchReports.forEach((report) => {
      reports.push(report)
      logReceipt(report, options)
    })
    if (options.limit !== undefined && reports.length >= options.limit) reachedLimit = true
  }

  if (options.idsFile) {
    const listedIds = readFileSync(options.idsFile, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
    // Truncate before fetching: --limit must not cost one request per unscanned id.
    const ids = options.limit === undefined ? listedIds : listedIds.slice(0, options.limit)
    console.log(`Scanning ${ids.length} of the ${listedIds.length} receipt(s) listed in ${options.idsFile}`)
    const fetched = await mapWithConcurrency(ids, options.concurrency, async (id) => {
      try {
        return await receiptApi.getReceipt(id)
      } catch (e) {
        // Keep unreadable ids in the report, so that they show in the summary and in the exit code.
        const failure: ReceiptReport = {
          id,
          hasEncryptionMetadata: false,
          outcome: 'problem',
          attachments: [],
          error: `the receipt could not be fetched: ${(e as Error).message}`,
        }
        reports.push(failure)
        seen.add(id)
        logReceipt(failure, options)
        return undefined
      }
    })
    await processBatch(fetched.filter((it): it is Receipt => !!it))
  } else if (options.references.length > 0) {
    console.log(`Scanning the receipts carrying ${options.references.length} reference(s)`)
    for (const reference of options.references) {
      await processBatch(await receiptApi.listByReference(reference))
      if (reachedLimit) break
    }
  } else {
    const range = `${options.from ? new Date(options.from).toISOString() : 'the beginning of time'} .. ${
      options.to ? new Date(options.to).toISOString() : 'now'
    }`
    console.log(`Scanning every receipt created between ${range} (windows of ${options.windowDays || '∞'} day(s))`)
    for await (const batch of enumerateReceiptsByCreationDate(receiptApi, fetchImpl, options)) {
      await processBatch(batch)
      if (reachedLimit) break
    }
  }

  if (options.dumpDir) {
    // Re-download the problematic payloads only, so that the happy path never keeps whole attachments in memory.
    mkdirSync(options.dumpDir, { recursive: true })
    let dumped = 0
    for (const report of reports.filter((it) => it.outcome === 'problem')) {
      const receipt = await receiptApi.getReceipt(report.id).catch(() => undefined)
      if (!receipt) continue
      for (const attachment of report.attachments.filter((it) => it.outcome === 'bad-payload' || it.outcome === 'decrypt-failed')) {
        const legacyAttachmentId = receipt.attachmentIds?.[attachment.blobType]
        const retrieved =
          attachment.via === 'legacyAttachment' && legacyAttachmentId
            ? await receiptApi.getAndTryDecryptReceiptAttachment(receipt, legacyAttachmentId).catch(() => undefined)
            : attachment.via === 'dataAttachment'
            ? await receiptApi.getAndTryDecryptReceiptDataAttachment(receipt, attachment.blobType).catch(() => undefined)
            : undefined
        if (!retrieved) continue
        const name = `${report.id}.${attachment.blobType.replace(/[^\w.-]/g, '_')}.bin`
        writeFileSync(join(options.dumpDir, name), Buffer.from(retrieved.data))
        dumped++
      }
    }
    console.log(`Wrote ${dumped} problematic payload(s) to ${options.dumpDir}`)
  }

  const attachments = reports.flatMap((it) => it.attachments)
  const summary = {
    receipts: {
      scanned: reports.length,
      ok: reports.filter((it) => it.outcome === 'ok').length,
      withoutAttachment: reports.filter((it) => it.outcome === 'no-attachment').length,
      problematic: reports.filter((it) => it.outcome === 'problem').length,
    },
    attachments: {
      total: attachments.length,
      validXml: attachments.filter((it) => it.format === 'xml').length,
      validJson: attachments.filter((it) => it.format === 'json').length,
      badPayload: attachments.filter((it) => it.outcome === 'bad-payload').length,
      decryptFailed: attachments.filter((it) => it.outcome === 'decrypt-failed').length,
      downloadFailed: attachments.filter((it) => it.outcome === 'download-failed').length,
      storedInClear: attachments.filter((it) => !!it.storedInClear).length,
      compressed: attachments.filter((it) => !!it.compressionAlgorithm).length,
    },
  }

  const rows: [string, number][] = [
    ['Receipts scanned', summary.receipts.scanned],
    ['  all payloads valid', summary.receipts.ok],
    ['  without attachment', summary.receipts.withoutAttachment],
    ['  problematic', summary.receipts.problematic],
    ['Attachments', summary.attachments.total],
    ['  valid xml', summary.attachments.validXml],
    ['  valid json', summary.attachments.validJson],
    ['  neither xml nor json', summary.attachments.badPayload],
    ['  decryption failed', summary.attachments.decryptFailed],
    ['  download failed', summary.attachments.downloadFailed],
    ['  valid but stored in clear', summary.attachments.storedInClear],
    ['  compressed on the client side', summary.attachments.compressed],
  ]
  const labelWidth = Math.max(...rows.map(([label]) => label.length))
  console.log('')
  rows.forEach(([label, value]) => console.log(`${label.padEnd(labelWidth)}  ${value}`))
  if (reachedLimit) console.log(`Stopped early because --limit ${options.limit} was reached.`)

  if (options.out) {
    writeFileSync(
      options.out,
      JSON.stringify({ host: options.host, scannedAt: new Date().toISOString(), dataOwnerId: self.dataOwner.id, summary, receipts: reports }, null, 2)
    )
    console.log(`Full report written to ${options.out}`)
  }

  // Exit code 1 whenever at least one receipt is broken, so the scan can be used as a check in a pipeline.
  process.exit(summary.receipts.problematic > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(`\n${(e as Error).message ?? e}`)
  process.exit(2)
})
