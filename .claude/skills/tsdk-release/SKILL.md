---
name: tsdk-release
description: Use when releasing a new version of @icure/api to NPM and GitHub from this repo — "release the sdk", "publish a new version", "cut a release", "bump and publish".
---

# Releasing @icure/api

Publishes a new version to NPM and GitHub in one pass: preflight checks, version bump, release notes in RELEASES.md, tag, `yarn run publish`, GitHub release.

**Each step gates the next. If a step fails, stop and report — never continue past a failed check.**

**Interactive prompts:** commits, tags and pushes are SSH-signed through the Secretive agent, which may refuse to sign from a non-interactive shell (`agent refused operation` / `Permission denied (publickey)`). If that happens, don't retry blindly: ask the user to run the exact same command with the `!` prefix so they can approve Secretive's prompt. Remote-only operations (deleting a tag/release) can alternatively go through `gh api`, which uses an HTTPS token and needs no SSH.

## 1. Preflight — everything pushed on release/v8

```bash
git fetch origin
git status --porcelain            # must be empty
git branch --show-current         # must be release/v8
git rev-parse HEAD origin/release/v8   # must be identical
```

Any mismatch → stop and tell the user what differs (uncommitted files, unpushed commits, wrong branch).

## 2. NPM authentication

```bash
npm whoami
```

If it fails, `npm login` is interactive — ask the user to run `! npm login` themselves, then re-check `npm whoami`.

## 3. Choose the new version

```bash
npm view @icure/api versions --json   # existing versions — the new one must NOT be in this list
git log --no-merges --format='%s' $(git describe --tags --abbrev=0)..HEAD
```

Apply semver to the commits since the last release: bug fixes only → patch; new features/endpoints/models → minor; breaking API changes → major. Propose the version to the user and get confirmation before proceeding. It must not exist on NPM and must be greater than the latest published 8.x version.

## 4. Bump and commit

Edit `"version"` in `package.json`, then:

```bash
git add package.json && git commit -m "Bumped version to <VERSION>"
BUMP_SHA=$(git rev-parse HEAD)
```

## 5. Draft release notes in RELEASES.md

Append an entry at the end of `RELEASES.md`, in the exact format used by `scripts/create-releases.ts`:

```markdown
## [MISSING] <VERSION> (<YYYY-MM-DD>)
<!-- tag: <VERSION> | target: <BUMP_SHA> | prerelease: false -->

- <commit subject 1>
- <commit subject 2>
```

The `[MISSING]` marker is required: entries without a status marker are treated as already published and skipped by `create-releases.ts`.

- Bullets come from the commit subjects since the previous release (step 3); drop version-bump/merge/noise commits and deduplicate.
- Prerelease versions (`-RC.x`, `-beta.x`) → `prerelease: true`.
- Show the drafted entry to the user for review before continuing.

```bash
git add RELEASES.md && git commit -m "Added release notes for <VERSION>"
```

## 6. Tag and push

Tags use the plain version, no `v` prefix, on the bump commit:

```bash
git tag <VERSION> $BUMP_SHA
git push origin release/v8 <VERSION>
```

## 7. Publish to NPM

```bash
yarn run publish
```

This builds (`prepare`) and runs `npm publish` from `dist/`. NPM requires a fresh one-time password at publish time, even right after a successful `npm login` — expect an `EOTP` error or a masked browser-auth URL. When that happens the build is already done: ask the user to run `! cd dist && npm publish` themselves (or `! cd dist && npm publish --otp=<code>`) and complete the OTP flow.

Always verify before continuing: `npm view @icure/api@<VERSION> version` must return the version — a 404 means the publish did NOT complete (e.g. the OTP prompt was abandoned), regardless of how much tarball output was printed.

## 8. Create the GitHub release

```bash
bun scripts/create-releases.ts --only <VERSION>
```

It reads the RELEASES.md entry and creates the release on the pushed tag. Verify with `gh release view <VERSION>`. Then remove the `[MISSING] ` marker from the entry's header in RELEASES.md (no marker = published), commit (`Marked <VERSION> as released`) and push.

## 9. Bump the dependence in fhc-api
The repository ../fhc-api depends on @icure/api. If the new release becomes incompatible with the peerDependencies definition in fhc-api package.json. Do a patch release of fhc-api using the sister skill in fhc-api repo: fhc-release

## Failure recovery

| Failed step                                         | Recovery                                                          |
|-----------------------------------------------------|-------------------------------------------------------------------|
| Git command: `agent refused operation`              | User runs the same command with `!` prefix and approves Secretive |
| `npm publish` fails with `EOTP` / auth URL          | User runs `! cd dist && npm publish` and completes the OTP; then verify with `npm view` |
| `yarn run publish` (7)                              | Fix the build issue; tag and notes are fine — retry publish only  |
| NPM publish succeeded but GitHub release (8) failed | Re-run step 8 only; never re-publish to NPM                       |
| Wrong version published                             | NPM versions are immutable — release a new patch, don't unpublish |
