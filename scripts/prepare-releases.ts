/**
 * Phase 1: generate RELEASES.md for all @icure/api v8 versions published on NPM.
 *
 * For each NPM version we determine:
 *  - status: OK (release exists with a real description, emitted without a status
 *    marker), TERSE (release exists but description is empty/very short), MISSING
 *    (no GitHub release)
 *  - the git tag (existing one, `v`-prefixed or not) or the commit that bumped
 *    package.json to that version (for versions that were never tagged)
 *  - a generated description built from the commit subjects between the previous
 *    published version and this one
 *
 * Run with: bun scripts/prepare-releases.ts
 */

import { spawnSync } from 'child_process'

const REPO = 'icure/icure-typescript-sdk'
const PKG = '@icure/api'
const TERSE_THRESHOLD = 40 // chars of meaningful body text

function run(cmd: string, args: string[], allowFail = false): string {
  const res = spawnSync(cmd, args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
  if (res.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${res.stderr}`)
  }
  return res.stdout ?? ''
}

// ---------------------------------------------------------------------------
// 1. NPM versions + publish dates
// ---------------------------------------------------------------------------
console.error('Fetching NPM packument...')
const packument = (await (await fetch(`https://registry.npmjs.org/${PKG}`)).json()) as {
  time: Record<string, string>
  versions: Record<string, { gitHead?: string }>
}
const versions = Object.keys(packument.time)
  .filter((v) => /^8\./.test(v))
  .map((v) => ({ version: v, publishedAt: packument.time[v], gitHead: packument.versions[v]?.gitHead }))
  .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
console.error(`  ${versions.length} v8 versions on NPM`)

// ---------------------------------------------------------------------------
// 2. Existing GitHub releases (with bodies)
// ---------------------------------------------------------------------------
console.error('Fetching GitHub releases...')
type GhRelease = { tag_name: string; name: string; body: string | null; draft: boolean; prerelease: boolean; html_url: string }
// --paginate outputs one JSON array per page, one per line
const ghReleases: GhRelease[] = run('gh', [
  'api',
  `repos/${REPO}/releases`,
  '--paginate',
  '-q',
  '[.[] | {tag_name, name, body, draft, prerelease, html_url}]',
])
  .split('\n')
  .filter(Boolean)
  .flatMap((page) => JSON.parse(page) as GhRelease[])
const releaseByVersion = new Map<string, GhRelease>()
for (const r of ghReleases) {
  const v = r.tag_name.replace(/^v/, '')
  if (/^8\./.test(v)) releaseByVersion.set(v, r)
}
console.error(`  ${releaseByVersion.size} existing v8 GitHub releases`)

// ---------------------------------------------------------------------------
// 3. Git tags for v8 versions
// ---------------------------------------------------------------------------
const tagByVersion = new Map<string, string>()
for (const tag of run('git', ['tag', '--list']).split('\n').filter(Boolean)) {
  const v = tag.replace(/^v/, '')
  if (/^8\./.test(v) && !tagByVersion.has(v)) tagByVersion.set(v, tag)
}

// ---------------------------------------------------------------------------
// 4. Resolve each version to a commit
// ---------------------------------------------------------------------------
function versionInPackageJson(sha: string): string | null {
  const content = run('git', ['show', `${sha}:package.json`], true)
  const m = content.match(/"version"\s*:\s*"([^"]+)"/)
  return m ? m[1] : null
}

function commitExists(sha: string): boolean {
  return spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`]).status === 0
}

console.error('Resolving versions to commits...')
const commitByVersion = new Map<string, string>()
for (const { version, gitHead } of versions) {
  // 1. The exact commit the version was published from, as recorded by npm
  if (gitHead && commitExists(gitHead)) {
    commitByVersion.set(version, gitHead)
    continue
  }
  // 2. An existing git tag for this version
  const tag = tagByVersion.get(version)
  if (tag) {
    commitByVersion.set(version, run('git', ['rev-list', '-1', tag]).trim())
    console.error(`  ${version}: npm gitHead unusable, resolved via tag ${tag}`)
    continue
  }
  // 3. Find the commit that introduced this version string into package.json
  const candidates = run('git', ['log', '--all', '--format=%H %ct', `-S"version": "${version}"`, '--', 'package.json'], true)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, ct] = l.split(' ')
      return { sha, ct: parseInt(ct) }
    })
    // keep only commits where package.json actually contains this version (i.e. the bump, not the removal)
    .filter((c) => versionInPackageJson(c.sha) === version)
    .sort((a, b) => a.ct - b.ct)
  if (candidates.length > 0) {
    commitByVersion.set(version, candidates[0].sha)
    console.error(`  ${version}: no tag, resolved to bump commit ${candidates[0].sha.slice(0, 10)}`)
  } else {
    console.error(`  ${version}: WARNING - no tag and no bump commit found`)
  }
}

// ---------------------------------------------------------------------------
// 5. Generate descriptions from commit ranges
// ---------------------------------------------------------------------------
const NOISE = new RegExp(
  [
    '^(bump(ed)? version|version bump|bump|prettier|format(ting)?|wip)\\.?$', // pure housekeeping
    '^v?\\d+\\.\\d+\\.\\d+(-[\\w.]+)?$', // commit subject is just a version number
    '^release\\s+v?\\d', // "Release 8.0.0"
    '^bump(ed)?\\s+(to\\s+)?v?\\d', // "Bump 8.0.5", "Bumped to v8.1.0"
  ].join('|'),
  'i'
)

function commitSubjects(prevSha: string | undefined, sha: string): string[] {
  const range = prevSha ? [`^${prevSha}`, sha] : ['-20', sha]
  const out = run('git', ['log', '--no-merges', '--format=%s', ...range], true)
  const seen = new Set<string>()
  const subjects: string[] = []
  for (const s of out.split('\n').map((l) => l.trim()).filter(Boolean).reverse()) {
    if (NOISE.test(s)) continue
    if (/^Merge (branch|pull request|remote)/i.test(s)) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    subjects.push(s)
  }
  return subjects
}

function describe(prevSha: string | undefined, sha: string | undefined): string {
  if (!sha)
    return '_The commit this version was published from was never pushed to the repository. The release tag points at the previous version; the changes of this version are listed in the next version’s release notes._'
  const subjects = commitSubjects(prevSha, sha)
  if (subjects.length === 0) return 'Maintenance release (version bump only).'
  return subjects.map((s) => `- ${s[0].toUpperCase()}${s.slice(1)}`).join('\n')
}

// ---------------------------------------------------------------------------
// 6. Write RELEASES.md
// ---------------------------------------------------------------------------
console.error('Generating RELEASES.md...')
const lines: string[] = [
  '# @icure/api v8 releases',
  '',
  `> Generated by \`scripts/prepare-releases.ts\`. Review the descriptions, then run \`bun scripts/create-releases.ts\`.`,
  `> Entries without a status marker are published GitHub releases (left untouched). **[TERSE]** = existing release`,
  `> whose description will be replaced by the one below, **[MISSING]** = release to be created.`,
  '',
]

let prevSha: string | undefined
let ok = 0
let terse = 0
let missing = 0
let unresolved = 0

for (const { version, publishedAt } of versions) {
  const sha = commitByVersion.get(version)
  const release = releaseByVersion.get(version)
  const tag = release?.tag_name ?? tagByVersion.get(version) ?? version
  const prerelease = /-(RC|rc|beta|alpha)/.test(version)
  const date = publishedAt.slice(0, 10)

  let status: 'OK' | 'TERSE' | 'MISSING'
  let body: string
  if (!release) {
    status = 'MISSING'
    body = describe(prevSha, sha)
    missing++
    if (!sha) unresolved++
  } else {
    const existingBody = (release.body ?? '').trim()
    const meaningful = existingBody.replace(/\s+/g, ' ').replace(new RegExp(`^v?${version.replace(/\./g, '\\.')}$`), '')
    if (meaningful.length >= TERSE_THRESHOLD) {
      status = 'OK'
      body = existingBody
      ok++
    } else {
      status = 'TERSE'
      body = describe(prevSha, sha)
      if (existingBody) body += `\n\n<!-- original description: ${existingBody.replace(/-->/g, '')} -->`
      terse++
    }
  }

  // For versions whose publish commit was never pushed, anchor the tag on the previous version's commit
  const target = sha ?? prevSha ?? 'UNKNOWN'
  // Published releases (OK) carry no status marker; only actionable entries are marked
  lines.push(status === 'OK' ? `## ${version} (${date})` : `## [${status}] ${version} (${date})`)
  lines.push(`<!-- tag: ${tag} | target: ${target} | prerelease: ${prerelease} -->`)
  lines.push('')
  lines.push(body)
  lines.push('')

  if (sha) prevSha = sha
}

await Bun.write('RELEASES.md', lines.join('\n'))
console.error(`Done: ${ok} OK, ${terse} TERSE, ${missing} MISSING (${unresolved} without a resolvable commit) -> RELEASES.md`)
