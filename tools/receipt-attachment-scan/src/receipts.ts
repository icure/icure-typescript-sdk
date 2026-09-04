import { type IccReceiptXApi, Receipt, XHR } from '@icure/api'

type FetchImpl = (input: RequestInfo, init?: RequestInit) => Promise<Response>

/** Oldest creation date the windowed enumeration starts from when the caller does not give a --from bound. */
const DEFAULT_ANCHOR = Date.parse('2010-01-01T00:00:00Z')

/**
 * Lists the receipts created within the given interval (both bounds inclusive, an undefined bound leaves that side
 * open).
 *
 * `GET /rest/v2/receipt/byCreated` is not part of the *published* typescript SDK yet, so the request is issued
 * through the SDK's own `XHR` helper with the receipt api's host, access-control-keys headers and auth service. That
 * is exactly what a generated method would do, and it keeps token refresh and access control working.
 *
 * `IccReceiptApi.listReceiptsBetweenDates` now exists on the `release/v8` branch: once a version carrying it is
 * published, bump `@icure/api` and replace this whole function with
 * `receiptApi.listReceiptsBetweenDates(startDate, endDate, descending)`.
 */
export async function listReceiptsBetweenDates(
  receiptApi: IccReceiptXApi,
  fetchImpl: FetchImpl,
  startDate: number | undefined,
  endDate: number | undefined,
  descending = false
): Promise<Receipt[]> {
  const url =
    `${receiptApi.host}/receipt/byCreated?ts=${Date.now()}` +
    (startDate !== undefined ? `&startDate=${encodeURIComponent(String(startDate))}` : '') +
    (endDate !== undefined ? `&endDate=${encodeURIComponent(String(endDate))}` : '') +
    (descending ? '&descending=true' : '')
  try {
    const response = await XHR.sendCommand(
      'GET',
      url,
      await receiptApi.headers,
      null,
      fetchImpl,
      undefined,
      receiptApi.authenticationProvider.getAuthService()
    )
    return ((response.body as unknown[]) ?? []).map((it) => new Receipt(it as never))
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

/** Walks the whole receipt collection window by window, yielding one batch per window. */
export async function* enumerateReceiptsByCreationDate(
  receiptApi: IccReceiptXApi,
  fetchImpl: FetchImpl,
  options: { from?: number; to?: number; windowDays: number }
): AsyncGenerator<Receipt[]> {
  for (const { startDate, endDate } of creationDateWindows(options)) {
    yield await listReceiptsBetweenDates(receiptApi, fetchImpl, startDate, endDate)
  }
}
