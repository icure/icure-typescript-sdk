# receipt-attachment-scan

A [Bun](https://bun.sh) application that walks every receipt of an iCure database, downloads and decrypts each
attachment, and checks that the resulting payload is either a valid XML document or a valid JSON document.

It uses the **published** `@icure/api` SDK (`^8.14.0`), not the sources of this repository, so it exercises the same
code path an application would.

## Install

```bash
cd tools/receipt-attachment-scan
bun install
```

## Run

```bash
bun run src/index.ts \
  --host https://kraken.icure.cloud \
  --refresh-token-file ./refresh-token.txt \
  --keys ./keys \
  --out report.json
```

`--keys` accepts a file or a directory (walked recursively) and can be repeated. Put the private key of the logged
user **and** the private keys of its parent data owners there: each key is matched to the data owner that declares the
corresponding public key, so the order and the file names do not matter. Accepted formats:

| Format                                     | Example                                        |
| ------------------------------------------ | ---------------------------------------------- |
| PEM, PKCS#8 or PKCS#1, unencrypted         | `-----BEGIN PRIVATE KEY-----…`                 |
| Raw DER                                    | output of `openssl genpkey -outform DER`       |
| Hex encoded PKCS#8                         | what `RSAUtils.exportKey(key, 'pkcs8')` gives  |
| Base64 encoded PKCS#8                      | the PEM body, without the armour               |
| JWK, or a JWK set (`{ "keys": [ … ] }`)    | `{"kty":"RSA","n":"…","d":"…"}`                |
| iCure hex pair                             | `{"publicKey":"30820…","privateKey":"30820…"}` |

Run `bun run src/index.ts --help` for the full list of options. `bun test` runs the unit tests (key parsing, payload
classification, enumeration windows).

### Authentication

The application authenticates with a JWT **refresh** token, which it exchanges for an auth token on start-up
(`POST /rest/v2/auth/refresh`) and then hands to the SDK. Pass it with `--refresh-token-file <path>` or
`$ICURE_REFRESH_TOKEN`; `--refresh-token <jwt>` also works but leaves the token visible in the process list.

Since the refresh token cannot be renewed, a scan cannot outlive its validity. Restrict the range with `--from` /
`--to` and re-run if a full scan is too long for one token.

### Selecting what to scan

By default every receipt of the database is scanned. Receipts are enumerated with
`GET /rest/v2/receipt/byCreated`, in windows of `--window-days` days (30 by default) — the endpoint is not paginated,
so windows keep each response to a workable size. The first window has an open lower bound, which also picks up
receipts that carry no creation date at all.

The call goes through `IccReceiptXApi.listReceiptsBetweenDates`, added to the SDK in 8.14.0. Older backends may not
expose the endpoint; the scan reports that explicitly instead of surfacing a bare 404, and you can fall back to
`--ids-file` or `--ref`.

- `--from` / `--to` restrict the creation-date range (ISO-8601 or a unix epoch in ms).
- `--ids-file <path>` scans only the receipt ids listed in a file, one per line.
- `--ref <reference>` scans only the receipts carrying that reference (repeatable).
- `--limit <n>` stops early, which is handy for a first smoke run.

## What it reports

For every blob type of every receipt the tool picks the right download path and classifies the payload:

- **`ok`** — decrypted and the payload is a valid XML or JSON document.
- **`bad-payload`** — decrypted, but the payload is neither. The report says why (`starts like xml but is invalid: …`,
  `neither xml nor json: …`), names the format when the bytes have a recognisable magic number (`gzip`, `xz`, `zip`,
  `pdf`, …) and includes a hex/ascii preview of the first 32 bytes.
- **`decrypt-failed`** — the bytes were downloaded, no available key could decrypt them, *and* the raw bytes are not a
  document either. An attachment that no key decrypts but that still holds a valid XML or JSON payload is reported as
  `ok` with `storedInClear: true`: it was uploaded in clear on an encrypted receipt, which is a very different problem
  from undecryptable garbage. Receipts that carry no encryption metadata at all are simply expected to be in clear and
  are not flagged.
- **`download-failed`** — the attachment could not be retrieved, or its decompression failed.

Both attachment generations are covered: the compression-aware data attachment
(`attachmentInfos` → `getAndTryDecryptReceiptDataAttachment`, which also decompresses) and the legacy attachment
(`attachmentIds` → `getAndTryDecryptReceiptAttachment`). When a receipt declares both, the data-attachment path is
tried first and the legacy one is used as a fallback; the report records when that happened.

The XML/JSON check is deliberately kept out of the SDK's `validator` callback. That callback is what the SDK uses to
choose between candidate decryption keys, so using it for the payload check would report a receipt that decrypts
perfectly but holds a non-XML/JSON payload as a decryption failure, merging the two failure modes this tool is meant
to tell apart.

Output:

- a live log — only problematic receipts unless `--verbose` is given;
- an aligned summary;
- the full findings as JSON with `--out <path>`;
- the raw bytes of every problematic payload with `--dump-dir <path>`, re-downloaded after the scan so that the happy
  path never holds whole attachments in memory. **These files contain patient data — treat them accordingly.**

Exit code: `0` when every scanned receipt is clean, `1` when at least one receipt is problematic, `2` on a fatal
error, so the scan can be used as a pipeline check.

## Read-only behaviour

The scan never modifies a receipt. Its crypto strategies (`src/strategies.ts`) also refuse to generate a key
(`generateNewKeyForDataOwner` returns `false`, so a missing key fails the scan loudly instead of producing a useless
report) and never accept a delegate's public key, so no exchange key or delegation can be created. Keys, verified-key
flags and exchange data are cached in memory only (`src/storage.ts`) and nothing is written to disk.

Two caveats, both inherent to `IcureApi.initialise` rather than to this tool:

- Initialisation runs the SDK's usual key maintenance. In practice it is a no-op here, because at most one key per
  data owner ends up verified and transfer keys are only created between several verified keys.
- If the logged user were a *patient* data owner, initialisation would ensure the patient has a delegation to itself,
  which is a write. This tool is meant for an HCP hierarchy.
