# Publishing mcp-open-library to the official MCP Registry

**Date:** 2026-08-08
**Status:** Approved

## Goal

List `mcp-open-library` in the official MCP Registry as `io.github.8enSmith/mcp-open-library`, and
replace today's manual npm release with a secretless, tag-triggered pipeline that publishes to npm
and the registry together.

## Background

The registry stores metadata only; the artifact stays on npm. It proves you own the npm package by
fetching your published `package.json` and checking that `mcpName` matches the server name in
`server.json`.

`mcp-open-library@1.0.2` is already on npm without `mcpName`. npm metadata cannot be amended in
place, so a new npm release is unavoidable — the first registry listing ships as `1.0.3`.

The repo currently has no release automation. `.github/workflows/` contains only `pr-greeter.yml`;
npm publishing is manual and tests run only through the husky pre-commit hook.

## The core problem

Once `server.json` exists, the release version is duplicated across five locations, and the server
identity across two more — all of which must agree:

| Location                            | Kind     | Value                                 |
| ----------------------------------- | -------- | ------------------------------------- |
| `package.json` `version`            | version  | `1.0.3`                               |
| `server.json` `version`             | version  | `1.0.3`                               |
| `server.json` `packages[0].version` | version  | `1.0.3`                               |
| git tag                             | version  | `v1.0.3`                              |
| `src/index.ts` `version`            | version  | `"1.0.0"` — already drifted           |
| `package.json` `mcpName`            | identity | `io.github.8enSmith/mcp-open-library` |
| `server.json` `name`                | identity | `io.github.8enSmith/mcp-open-library` |

Drift either fails the publish or, worse, ships a listing that misrepresents the package. The design
is chosen to make drift structurally impossible rather than merely detected.

**Single source of truth: `package.json` `version`.** Everything else is derived from or asserted
against it.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Full release automation | Keeps npm and registry versions in lockstep forever, not just once |
| Server name | `io.github.8enSmith/mcp-open-library` | Exactly matches repo and npm package name |
| npm auth | Trusted publishing (OIDC) | No stored credential; adds build provenance |
| Registry auth | `mcp-publisher login github-oidc` | No stored credential |
| Version sync | `npm version` lifecycle hook | Only approach where the repo cannot go inconsistent |

Both OIDC flows are covered by a single `id-token: write` permission, so the pipeline holds no
secrets at all.

## Components

### `server.json` (new, repo root)

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.8enSmith/mcp-open-library",
  "title": "Open Library",
  "description": "Search books and authors on the Internet Archive's Open Library",
  "version": "1.0.3",
  "websiteUrl": "https://github.com/8enSmith/mcp-open-library#readme",
  "repository": {
    "url": "https://github.com/8enSmith/mcp-open-library",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "mcp-open-library",
      "version": "1.0.3",
      "transport": { "type": "stdio" }
    }
  ]
}
```

The schema caps `description` at 100 characters; the string above is 62. No `environmentVariables`
or `packageArguments` — the server takes no configuration.

### `package.json` (changed)

- Add `"mcpName": "io.github.8enSmith/mcp-open-library"`.
- Add a `version` lifecycle script:

  ```json
  "version": "node scripts/sync-server-json.mjs && node scripts/promote-changelog.mjs && git add server.json CHANGELOG.md"
  ```

  npm runs this after bumping the version and before creating the commit, so `npm version patch`
  yields one commit and tag with every file already consistent.

  The changelog promotion was added after the original design: leaving it manual meant npm and the
  registry could say `1.0.3` while `CHANGELOG.md` still read `## [Unreleased]`. See
  `scripts/promote-changelog.mjs`.

### `scripts/sync-server-json.mjs` (new)

A pure function plus a thin CLI wrapper, so the logic is unit-testable without touching disk.

- `syncServerJson(serverJson, { version, mcpName })` → returns the updated object. Throws if
  `serverJson.name !== mcpName`.
- The wrapper reads both files, calls the function, and writes `server.json` back preserving
  two-space indentation and the trailing newline.

Sole responsibility: make `server.json` agree with `package.json`. It does not publish, tag, or bump.

### `scripts/assert-release-consistency.mjs` (new)

Same shape — pure function plus CLI wrapper. Given the tag name and both JSON files, asserts:

```text
tag minus "v"                      === package.json version
server.json version                === package.json version
server.json packages[0].version    === package.json version
server.json name                   === package.json mcpName
server.json packages[0].identifier === package.json name
```

Each mismatch reports which pair disagreed. The tag check is skipped when no tag is supplied, so the
same script serves PR validation.

### `src/index.ts` (changed)

Replace the hardcoded `version: "1.0.0"` at line 29 with a read from `package.json`:

```ts
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
```

`tsconfig.json` sets `rootDir: ./src` and `outDir: ./build`, so from `build/index.js` this resolves
to the package root in both the repo and the published tarball.

This drift predates the work, but an automated release that publishes `1.0.3` while the binary
announces `1.0.0` to every client is precisely the failure this design exists to prevent.

### `.github/workflows/publish-mcp.yml` (new)

Triggered by `push` on tags matching `v*`, consistent with the existing `v1.0.0`–`v1.0.2` tags.

```yaml
permissions:
  id-token: write   # npm trusted publishing AND mcp-publisher OIDC
  contents: read
```

Steps:

1. `actions/checkout`
2. `actions/setup-node` with `node-version-file: .nvmrc` (pins v22.21.1)
3. `npm install -g npm@latest` — Node 22 ships npm 10.x; trusted publishing requires ≥ 11.5.1
4. `npm ci`
5. `npm run lint`
6. `npm run test:precommit`
7. `npm run build`
8. `node scripts/assert-release-consistency.mjs "$GITHUB_REF_NAME"`
9. Install `mcp-publisher` → `validate` (before npm publish, so a malformed listing is caught before
   npm publishes irreversibly — `login` and `publish` still run after npm, so a failure there can
   still strand npm ahead of the registry; the guarded npm step makes the re-run safe)
10. Guarded `npm publish`
11. Poll npm until the new version is served
12. `login github-oidc` → `publish`

### `.github/workflows/validate-server-json.yml` (new)

On pull requests touching `server.json` or `package.json`: run the consistency assertion without a
tag, plus `mcp-publisher validate`. Catches a malformed listing before a tag is cut, while it is
still cheap to fix.

### Documentation (changed)

- `README.md` — installation via the MCP Registry.
- `CHANGELOG.md` — add the missing `1.0.2` entry and a `1.0.3` entry.

## Three details that matter more than they look

**Use `test:precommit`, not `test`.** The `test` script is bare `vitest`, which is watch mode and
would hang the runner until the job times out. The MCP registry docs show `npm run test --if-present`;
copied verbatim it breaks this repo. Only `test:precommit` (`vitest run`) is safe in CI.

**Guard `npm publish`.** The realistic failure is npm succeeding and the registry step failing after
it. Ungated, re-running the tag build dies on `E409 version already exists`, leaving the release
half-done and needing a hand-run `mcp-publisher`.

```bash
VERSION=$(node -p "require('./package.json').version")
if npm view "mcp-open-library@$VERSION" version >/dev/null 2>&1; then
  echo "Already published to npm, skipping"
else
  npm publish
fi
```

Re-running the whole workflow then converges rather than failing.

**Poll for npm propagation.** The registry fetches `package.json` from npm to verify `mcpName`.
Publish-to-readable is not instant, and losing that race surfaces as a misleading
`Package validation failed`. Poll `npm view mcp-open-library@$VERSION` with a ceiling of roughly 60
seconds.

## Error handling

| Failure | Behaviour | Recovery |
| --- | --- | --- |
| Tag disagrees with `package.json` | Step 8 fails before anything is published | Fix, delete tag, re-tag |
| `server.json` invalid | `mcp-publisher validate` fails; caught earlier on PRs | Fix and re-tag |
| npm publish fails | Nothing reaches the registry | Fix, re-run workflow |
| Registry publish fails after npm succeeded | npm step self-skips on re-run | Re-run workflow |
| npm not yet propagated | Poll absorbs it | Automatic |

## Testing

Vitest unit tests against the two pure functions:

- `syncServerJson` — bumps both version fields, preserves unrelated keys, throws on a
  name/`mcpName` mismatch.
- The consistency checker — passes when aligned, fails on each of the five mismatches individually.

The workflow itself gets no test; it is proven by the first real tag push.

## Manual steps (cannot be automated)

Both must happen before the first tag is pushed.

1. **npm trusted publisher.** npmjs.com → `mcp-open-library` → Settings → Trusted publisher. Owner
   `8enSmith`, repo `mcp-open-library`, workflow `publish-mcp.yml`. Without this, the publish step
   fails.
2. **Namespace pre-flight.** *Done — and it overturned an assumption.* This design originally
   assumed registry namespaces were lowercased to `io.github.8ensmith`. They are not. The registry
   builds the grant as `io.github.<owner>/*` from GitHub's login verbatim — `io.github.8enSmith/*`,
   capital `S` — on both the access-token and OIDC paths (`internal/api/handlers/v0/auth/github_oidc.go:293`),
   and matches it against the raw `server.json` name with a case-sensitive `strings.HasPrefix`
   (`internal/auth/jwt.go:165-173`). The lowercased name would have been rejected — and because
   `validate` does not check namespace permissions, the rejection would have landed at
   `mcp-publisher publish`, after npm had already published immutably. The name is now
   `io.github.8enSmith/mcp-open-library` everywhere.

   To re-verify at any time: run `mcp-publisher login github` and decode
   `~/.config/mcp-publisher/token.json` to read the granted namespace claim.

## Rollout

1. Land the repo changes via PR. Nothing publishes — the workflow is tag-only.
2. Configure the npm trusted publisher.
3. Run the namespace pre-flight.
4. Confirm `CHANGELOG.md` has a `## [Unreleased]` section describing the release. The `version` hook
   promotes it to `## [<version>] - <date>` automatically and fails the bump if it is missing.
5. `npm version patch` → `git push --follow-tags`.
6. Verify:

   ```bash
   npm view mcp-open-library@1.0.3 mcpName
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.8enSmith/mcp-open-library"
   ```

## Out of scope

- **General test CI.** The repo has no workflow running tests on PRs; tests run only via the husky
  pre-commit hook. Worth fixing, but it is a separate concern from publishing.
- **Compiled tests in the published tarball.** `build/` contains `index.test.js` and `files:
  ["build"]` ships it to npm. A packaging wart, unrelated to this work.
- **Smithery, Glama and other existing listings.** Unaffected.

## Notes

An unrelated `io.github.pipeworx-io/open-library` (a remote server behind a gateway) already exists
in the registry. Different namespace, so there is no conflict — noted only so it is not a surprise
when searching.
