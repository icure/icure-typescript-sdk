import { readFileSync } from 'node:fs'

export interface Options {
  host: string
  refreshToken: string
  keyPaths: string[]
  from?: number
  to?: number
  windowDays: number
  idsFile?: string
  references: string[]
  concurrency: number
  limit?: number
  out?: string
  dumpDir?: string
  verbose: boolean
}

const USAGE = `
Scans the receipts of an iCure database, decrypts their attachments and checks that
each payload is valid XML or valid JSON.

Usage:
  bun run src/index.ts --host <url> [options]

Authentication (exactly one is required):
  --refresh-token <jwt>        iCure JWT refresh token. Visible in the process list,
                               prefer one of the two options below.
  --refresh-token-file <path>  File containing the refresh token.
  ICURE_REFRESH_TOKEN=<jwt>    Environment variable.

Keys (at least one is required):
  --keys <path>                File or directory holding a private key of the logged
                               user or of one of its parents. Repeatable. Accepted
                               formats: PEM (PKCS#8 or PKCS#1), raw DER, hex, base64,
                               JWK, or the iCure { publicKey, privateKey } hex json.
                               Keys are matched to data owners by public key, so the
                               order does not matter.
                               Defaults to $ICURE_KEYS (':' separated).

What to scan (defaults to every receipt of the database):
  --from <date>                Only receipts created at or after this date.
  --to <date>                  Only receipts created at or before this date.
                               Dates are ISO-8601 ('2024-03-01', '2024-03-01T10:00:00Z')
                               or a unix epoch in milliseconds.
  --window-days <n>            Size of the creation-date windows used to page through
                               the database (default 30, 0 = a single request).
  --ids-file <path>            Scan only the receipt ids listed in this file, one per
                               line. Skips the date based enumeration.
  --ref <reference>            Scan only the receipts carrying this reference.
                               Repeatable. Skips the date based enumeration.

Output:
  --out <path>                 Write the full JSON report to this file.
  --dump-dir <path>            Write the payload of every problematic attachment to
                               this directory, for manual inspection.
  --concurrency <n>            Receipts processed in parallel (default 8).
  --limit <n>                  Stop after this many receipts.
  --verbose                    Log every receipt, not only the problematic ones.
  -h, --help                   Show this message.
`

function parseDate(raw: string, flag: string): number {
  if (/^-?\d+$/.test(raw)) return Number(raw)
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) throw new Error(`${flag}: '${raw}' is neither an ISO-8601 date nor a unix epoch in ms`)
  return parsed
}

function parseInteger(raw: string, flag: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${flag}: '${raw}' is not a positive integer`)
  return Number(raw)
}

export function parseArgs(argv: string[]): Options {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(USAGE.trim())
    process.exit(0)
  }

  let host: string | undefined = process.env.ICURE_HOST
  let refreshToken: string | undefined = process.env.ICURE_REFRESH_TOKEN
  const keyPaths: string[] = (process.env.ICURE_KEYS ?? '')
    .split(':')
    .map((it) => it.trim())
    .filter((it) => it.length > 0)
  const references: string[] = []
  let from: number | undefined
  let to: number | undefined
  let windowDays = 30
  let idsFile: string | undefined
  let concurrency = 8
  let limit: number | undefined
  let out: string | undefined
  let dumpDir: string | undefined
  let verbose = false
  let tokenOnCommandLine = false

  const next = (i: number, flag: string): string => {
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`)
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    switch (flag) {
      case '--host':
        host = next(i, flag)
        i++
        break
      case '--refresh-token':
        refreshToken = next(i, flag)
        tokenOnCommandLine = true
        i++
        break
      case '--refresh-token-file':
        refreshToken = readFileSync(next(i, flag), 'utf8').trim()
        i++
        break
      case '--keys':
        keyPaths.push(next(i, flag))
        i++
        break
      case '--from':
        from = parseDate(next(i, flag), flag)
        i++
        break
      case '--to':
        to = parseDate(next(i, flag), flag)
        i++
        break
      case '--window-days':
        windowDays = parseInteger(next(i, flag), flag)
        i++
        break
      case '--ids-file':
        idsFile = next(i, flag)
        i++
        break
      case '--ref':
        references.push(next(i, flag))
        i++
        break
      case '--concurrency':
        concurrency = Math.max(1, parseInteger(next(i, flag), flag))
        i++
        break
      case '--limit':
        limit = Math.max(1, parseInteger(next(i, flag), flag))
        i++
        break
      case '--out':
        out = next(i, flag)
        i++
        break
      case '--dump-dir':
        dumpDir = next(i, flag)
        i++
        break
      case '--verbose':
        verbose = true
        break
      default:
        throw new Error(`Unknown argument '${flag}'. Run with --help for the usage.`)
    }
  }

  if (!host) throw new Error('Missing --host (or $ICURE_HOST), e.g. --host https://kraken.icure.cloud')
  if (host.includes('/rest/v')) throw new Error(`--host must be the bare host, without the '/rest/vN' api path: got '${host}'`)
  if (!refreshToken) throw new Error('Missing --refresh-token, --refresh-token-file or $ICURE_REFRESH_TOKEN')
  if (keyPaths.length === 0) throw new Error('Missing --keys (or $ICURE_KEYS): the private keys of the user and of its parents are needed to decrypt')
  if (from !== undefined && to !== undefined && from > to) throw new Error('--from is after --to')
  if (tokenOnCommandLine) {
    console.warn('Warning: the refresh token was passed on the command line and is visible to other processes. Prefer --refresh-token-file.')
  }

  return {
    host: host.replace(/\/+$/, ''),
    refreshToken,
    keyPaths,
    from,
    to,
    windowDays,
    idsFile,
    references,
    concurrency,
    limit,
    out,
    dumpDir,
    verbose,
  }
}
