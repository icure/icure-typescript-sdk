import type { IccReceiptXApi, Receipt, XHR } from '@icure/api'

/** Oldest creation date the windowed enumeration starts from when the caller does not give a --from bound. */
const DEFAULT_ANCHOR = Date.parse('2010-01-01T00:00:00Z')

/**
 * Lists the receipts created within the given interval (both bounds inclusive, an undefined bound leaves that side
 * open), turning a backend that does not expose the endpoint into an actionable message rather than a bare 404.
 */
export async function listReceiptsBetweenDates(
  receiptApi: IccReceiptXApi,
  startDate: number | undefined,
  endDate: number | undefined,
  descending?: boolean
): Promise<Receipt[]> {
  try {
    return await receiptApi.listReceiptsBetweenDates(startDate, endDate, descending)
  } catch (e) {
    if ((e as XHR.XHRError)?.statusCode === 404) {
      throw new Error(
        'The backend does not expose GET /rest/v2/receipt/byCreated, so the receipts cannot be enumerated by ' +
          'creation date. Upgrade the backend, or restrict the scan with --ids-file or --ref.'
      )
    }
    throw e
  }
}

/**
 * Splits the requested creation-date range into the windows the enumeration will query, oldest first.
 *
 * The first window is left open on the lower side unless --from was given, which also picks up receipts that have no
 * creation date at all; symmetrically the last window is left open on the upper side unless --to was given, so that
 * receipts created while the scan runs are not missed. Bounds are inclusive on the backend, so consecutive windows
 * never overlap, but callers must still de-duplicate ids because a receipt may be modified between two requests.
 */
export function creationDateWindows(options: { from?: number; to?: number; windowDays: number }): { startDate?: number; endDate?: number }[] {
  const { from, to, windowDays } = options
  const upperBound = to ?? Date.now()

  if (windowDays === 0 || upperBound < (from ?? DEFAULT_ANCHOR)) return [{ startDate: from, endDate: to }]

  const span = windowDays * 24 * 60 * 60 * 1000
  const windows: { startDate?: number; endDate?: number }[] = []
  let cursor = from ?? DEFAULT_ANCHOR
  while (cursor <= upperBound) {
    const windowEnd = Math.min(cursor + span - 1, upperBound)
    windows.push({
      startDate: windows.length === 0 && from === undefined ? undefined : cursor,
      endDate: windowEnd === upperBound && to === undefined ? undefined : windowEnd,
    })
    cursor = windowEnd + 1
  }
  return windows
}

/**
 * Walks the whole receipt collection window by window, yielding one batch per window. Windows keep each response
 * small enough to handle, since the endpoint is not paginated.
 */
export async function* enumerateReceiptsByCreationDate(
  receiptApi: IccReceiptXApi,
  options: { from?: number; to?: number; windowDays: number }
): AsyncGenerator<Receipt[]> {
  for (const { startDate, endDate } of creationDateWindows(options)) {
    yield await listReceiptsBetweenDates(receiptApi, startDate, endDate)
  }
}
