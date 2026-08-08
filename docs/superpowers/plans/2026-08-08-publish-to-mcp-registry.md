# Publish to MCP Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List `mcp-open-library` in the official MCP Registry as `io.github.8enSmith/mcp-open-library`, published by a secretless, tag-triggered pipeline that releases to npm and the registry together.

**Architecture:** `package.json` `version` is the single source of truth. An `npm version` lifecycle hook derives `server.json` from it; `src/index.ts` reads it at runtime; CI asserts every copy agrees before publishing anything. Both npm and the MCP registry authenticate over GitHub OIDC, so no credential is ever stored.

**Tech Stack:** Node 22 (ESM), TypeScript, vitest, GitHub Actions, `mcp-publisher` CLI, npm trusted publishing.

**Spec:** `docs/superpowers/specs/2026-08-08-mcp-registry-publishing-design.md`

## Global Constraints

- Server name is **`io.github.8enSmith/mcp-open-library`** — permanent, must be byte-identical in `server.json` `name` and `package.json` `mcpName`. **The capital `S` is required.** The registry grants `io.github.<owner>/*` from GitHub's login verbatim and matches it with a case-sensitive `strings.HasPrefix` (`internal/auth/jwt.go:165-173`), so a lowercased name is rejected at publish time.
- npm package name is **`mcp-open-library`**; it must equal `server.json` `packages[0].identifier`.
- `server.json` `description` is capped at **100 characters** by the schema.
- Schema URI is **`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`**.
- CI must run **`npm run test:precommit`**, never `npm test` — the latter is bare `vitest` (watch mode) and will hang the runner until the job times out.
- npm trusted publishing requires **npm ≥ 11.5.1** and **Node ≥ 22.14.0**. `.nvmrc` pins v22.21.1, but Node 22 ships npm 10.x, so CI must run `npm install -g npm@latest`.
- Workflows that publish need **`id-token: write`** — one permission covers both npm OIDC and `mcp-publisher login github-oidc`.
- **`server.json` is committed at version `1.0.2`, matching today's `package.json`.** The spec shows `1.0.3` because that is what ships; the bump to `1.0.3` happens later via `npm version patch`. Committing `1.0.3` now would make the Task 1 checker fail on every PR.
- New scripts are plain `.mjs`, not TypeScript. The `version` hook must run before any build step exists, so these files cannot depend on `tsc` output.
- Scripts use `if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))` to detect direct invocation, not the `src/index.ts:75` idiom (`process.argv[1] === new URL(import.meta.url).pathname`) — that comparison fails open (silently exits 0) when the checkout path contains a space or is reached via a symlink, which is unacceptable for a release gate. `src/index.ts` keeps its existing idiom; it is out of scope here.
- ESLint enforces `import/order` with `newlines-between: always`. `node:` builtins go in the first group, followed by a blank line.
- Conventional commits (the repo uses commitizen).

---

### Task 1: Release-consistency checker

The invariant everything else depends on. Written first so Task 2 has something to verify it with.

**Files:**

- Create: `scripts/assert-release-consistency.mjs`
- Test: `scripts/assert-release-consistency.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `checkReleaseConsistency({ pkg, server, tag }) => string[]` — returns an array of human-readable problem descriptions, empty when consistent. `tag` is optional; when `undefined` the tag check is skipped. Tasks 5 and 6 invoke the file as a CLI.

Vitest has no config file in this repo, so it uses default `include` globs — `scripts/*.test.mjs` is picked up automatically with no wiring.

- [ ] **Step 1: Write the failing test**

Create `scripts/assert-release-consistency.test.mjs`:

```js
import { describe, it, expect } from "vitest";

import { checkReleaseConsistency } from "./assert-release-consistency.mjs";

const pkg = {
  name: "mcp-open-library",
  version: "1.0.3",
  mcpName: "io.github.8enSmith/mcp-open-library",
};

const server = {
  name: "io.github.8enSmith/mcp-open-library",
  version: "1.0.3",
  packages: [{ identifier: "mcp-open-library", version: "1.0.3" }],
};

describe("checkReleaseConsistency", () => {
  it("returns no problems when everything agrees", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "v1.0.3" })).toEqual([]);
  });

  it("skips the tag check when no tag is supplied", () => {
    expect(checkReleaseConsistency({ pkg, server })).toEqual([]);
  });

  it("accepts a tag without the v prefix", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "1.0.3" })).toEqual([]);
  });

  it("reports a tag that does not match package.json", () => {
    const problems = checkReleaseConsistency({ pkg, server, tag: "v9.9.9" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("git tag");
  });

  it("reports a server.json version mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, version: "1.0.2" },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("server.json version");
  });

  it("reports a packages[0].version mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        ...server,
        packages: [{ identifier: "mcp-open-library", version: "1.0.2" }],
      },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0].version");
  });

  it("reports a packages[0].identifier mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        ...server,
        packages: [{ identifier: "wrong-package", version: "1.0.3" }],
      },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0].identifier");
  });

  it("reports a name/mcpName mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, name: "io.github.8enSmith/wrong-name" },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("mcpName");
  });

  it("reports a missing packages entry", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, packages: [] },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0]");
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        name: "io.github.8enSmith/wrong-name",
        version: "1.0.1",
        packages: [{ identifier: "wrong-package", version: "1.0.2" }],
      },
      tag: "v9.9.9",
    });
    expect(problems).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/assert-release-consistency.test.mjs`
Expected: FAIL — cannot resolve `./assert-release-consistency.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/assert-release-consistency.mjs`:

```js
import { readFileSync } from "node:fs";

export function checkReleaseConsistency({ pkg, server, tag }) {
  const problems = [];
  const version = pkg.version;

  if (tag !== undefined) {
    const tagVersion = tag.startsWith("v") ? tag.slice(1) : tag;
    if (tagVersion !== version) {
      problems.push(
        `git tag "${tag}" does not match package.json version "${version}"`,
      );
    }
  }

  if (server.version !== version) {
    problems.push(
      `server.json version "${server.version}" does not match package.json version "${version}"`,
    );
  }

  const entry = server.packages?.[0];

  if (!entry) {
    problems.push("server.json has no packages[0] entry");
  } else {
    if (entry.version !== version) {
      problems.push(
        `server.json packages[0].version "${entry.version}" does not match package.json version "${version}"`,
      );
    }
    if (entry.identifier !== pkg.name) {
      problems.push(
        `server.json packages[0].identifier "${entry.identifier}" does not match package.json name "${pkg.name}"`,
      );
    }
  }

  if (server.name !== pkg.mcpName) {
    problems.push(
      `server.json name "${server.name}" does not match package.json mcpName "${pkg.mcpName}"`,
    );
  }

  return problems;
}

function readJson(relativePath) {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const problems = checkReleaseConsistency({
    pkg: readJson("../package.json"),
    server: readJson("../server.json"),
    tag: process.argv[2],
  });

  if (problems.length > 0) {
    console.error("Release metadata is inconsistent:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.log("Release metadata is consistent.");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/assert-release-consistency.test.mjs`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/assert-release-consistency.mjs scripts/assert-release-consistency.test.mjs
git commit -m "feat: add release metadata consistency checker"
```

---

### Task 2: Add `server.json` and `mcpName`

**Files:**

- Create: `server.json`
- Modify: `package.json` (add `mcpName` after `description`)

**Interfaces:**

- Consumes: the Task 1 CLI, used here as the acceptance test.
- Produces: `server.json` at the repo root — Tasks 3, 5 and 6 all read it.

Note the version is `1.0.2`, matching today's `package.json`. See Global Constraints.

- [ ] **Step 1: Create `server.json`**

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.8enSmith/mcp-open-library",
  "title": "Open Library",
  "description": "Search books and authors on the Internet Archive's Open Library",
  "version": "1.0.2",
  "websiteUrl": "https://github.com/8enSmith/mcp-open-library#readme",
  "repository": {
    "url": "https://github.com/8enSmith/mcp-open-library",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "mcp-open-library",
      "version": "1.0.2",
      "transport": { "type": "stdio" }
    }
  ]
}
```

- [ ] **Step 2: Add `mcpName` to `package.json`**

Insert immediately after the `"description"` line (`package.json:4`):

```json
  "mcpName": "io.github.8enSmith/mcp-open-library",
```

- [ ] **Step 3: Run the consistency checker against the real files**

Run: `node scripts/assert-release-consistency.mjs`
Expected: `Release metadata is consistent.` and exit code 0.

- [ ] **Step 4: Verify the checker actually fails on a bad tag**

Run: `node scripts/assert-release-consistency.mjs v9.9.9`
Expected: exit code 1, and output containing `git tag "v9.9.9" does not match package.json version "1.0.2"`.

This confirms the CLI wiring works, not just the pure function.

- [ ] **Step 5: Commit**

```bash
git add server.json package.json
git commit -m "feat: add server.json and mcpName for MCP registry listing"
```

---

### Task 3: Version-sync script and `npm version` hook

**Files:**

- Create: `scripts/sync-server-json.mjs`
- Test: `scripts/sync-server-json.test.mjs`
- Modify: `package.json` (add `version` lifecycle script)

**Interfaces:**

- Consumes: `server.json` from Task 2.
- Produces: `syncServerJson(server, { version, mcpName, packageName }) => object` — returns a new object; never mutates its input. Throws when `server.name !== mcpName`.

`packageName` scopes the version bump to the entry for *this* npm package, leaving any future entry for another registry alone. With one package today the behaviour is identical, but it makes the contract explicit.

- [ ] **Step 1: Write the failing test**

Create `scripts/sync-server-json.test.mjs`:

```js
import { describe, it, expect } from "vitest";

import { syncServerJson } from "./sync-server-json.mjs";

const mcpName = "io.github.8enSmith/mcp-open-library";
const packageName = "mcp-open-library";

function makeServer() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: mcpName,
    title: "Open Library",
    description: "Search books and authors on the Internet Archive's Open Library",
    version: "1.0.2",
    websiteUrl: "https://github.com/8enSmith/mcp-open-library#readme",
    repository: {
      url: "https://github.com/8enSmith/mcp-open-library",
      source: "github",
    },
    packages: [
      {
        registryType: "npm",
        identifier: packageName,
        version: "1.0.2",
        transport: { type: "stdio" },
      },
    ],
  };
}

describe("syncServerJson", () => {
  it("updates the top-level version", () => {
    const result = syncServerJson(makeServer(), {
      version: "1.0.3",
      mcpName,
      packageName,
    });
    expect(result.version).toBe("1.0.3");
  });

  it("updates the matching package entry version", () => {
    const result = syncServerJson(makeServer(), {
      version: "1.0.3",
      mcpName,
      packageName,
    });
    expect(result.packages[0].version).toBe("1.0.3");
  });

  it("leaves package entries for other registries untouched", () => {
    const server = makeServer();
    server.packages.push({
      registryType: "nuget",
      identifier: "Someone.Else",
      version: "9.9.9",
      transport: { type: "stdio" },
    });

    const result = syncServerJson(server, {
      version: "1.0.3",
      mcpName,
      packageName,
    });

    expect(result.packages[1].version).toBe("9.9.9");
  });

  it("preserves every unrelated field", () => {
    const server = makeServer();
    const result = syncServerJson(server, {
      version: "1.0.3",
      mcpName,
      packageName,
    });

    expect(result.$schema).toBe(server.$schema);
    expect(result.name).toBe(mcpName);
    expect(result.title).toBe("Open Library");
    expect(result.description).toBe(server.description);
    expect(result.websiteUrl).toBe(server.websiteUrl);
    expect(result.repository).toEqual(server.repository);
    expect(result.packages[0].registryType).toBe("npm");
    expect(result.packages[0].transport).toEqual({ type: "stdio" });
  });

  it("does not mutate the input", () => {
    const server = makeServer();
    syncServerJson(server, { version: "1.0.3", mcpName, packageName });
    expect(server.version).toBe("1.0.2");
    expect(server.packages[0].version).toBe("1.0.2");
  });

  it("throws when the server name does not match mcpName", () => {
    expect(() =>
      syncServerJson(makeServer(), {
        version: "1.0.3",
        mcpName: "io.github.8enSmith/something-else",
        packageName,
      }),
    ).toThrow(/does not match/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/sync-server-json.test.mjs`
Expected: FAIL — cannot resolve `./sync-server-json.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/sync-server-json.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";

export function syncServerJson(server, { version, mcpName, packageName }) {
  if (server.name !== mcpName) {
    throw new Error(
      `server.json name "${server.name}" does not match package.json mcpName "${mcpName}". ` +
        "The server name is permanent and must be corrected by hand.",
    );
  }

  return {
    ...server,
    version,
    packages: server.packages.map((entry) =>
      entry.identifier === packageName ? { ...entry, version } : entry,
    ),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const serverUrl = new URL("../server.json", import.meta.url);
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const server = JSON.parse(readFileSync(serverUrl, "utf8"));

  const updated = syncServerJson(server, {
    version: pkg.version,
    mcpName: pkg.mcpName,
    packageName: pkg.name,
  });

  writeFileSync(serverUrl, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`server.json synced to ${pkg.version}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/sync-server-json.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 5: Add the `version` lifecycle hook to `package.json`**

Add to `scripts`, immediately after the `"build"` entry:

```json
    "version": "node scripts/sync-server-json.mjs && git add server.json",
```

npm runs this after writing the new version to `package.json` and before creating the release commit, so the commit contains both files already in agreement.

- [ ] **Step 6: Commit**

Commit *before* exercising the hook. The next step's cleanup restores these files from `HEAD`, which would otherwise discard the hook you just added.

```bash
git add scripts/sync-server-json.mjs scripts/sync-server-json.test.mjs package.json
git commit -m "feat: sync server.json from package.json on npm version"
```

- [ ] **Step 7: Verify the hook end-to-end without releasing anything**

```bash
npm version patch --no-git-tag-version
node scripts/assert-release-consistency.mjs
```

Expected: `server.json` and `package.json` both now read `1.0.3`, and the checker reports consistent.

Then undo it — the real bump happens at release time. The hook runs `git add server.json`, so the bump is **staged** as well as in the working tree; a plain `git checkout` would restore the staged copy and silently leave the bump in place. Reset both:

```bash
git restore --source=HEAD --staged --worktree package.json package-lock.json server.json
node scripts/assert-release-consistency.mjs
git status --short
```

Expected: both files back to `1.0.2`, checker still consistent, and `git status` clean.

---

### Task 4: Fix the `src/index.ts` version drift

`src/index.ts:29` hardcodes `"1.0.0"` while the package is at `1.0.2`. Left alone, an automated release would publish `1.0.3` while the binary announces `1.0.0` to every client.

**Files:**

- Modify: `src/index.ts:1-10` (imports), `src/index.ts:29` (version)
- Test: `src/index.test.ts` (add one test)

**Interfaces:**

- Consumes: `package.json` `version`.
- Produces: no new exports. `OpenLibraryServer` keeps its existing signature.

`new URL("../package.json", import.meta.url)` resolves to the repo root from `src/index.ts` under vitest, and to the package root from `build/index.js` at runtime and inside the published tarball. Both work without a build step.

- [ ] **Step 1: Write the failing test**

Add the `readFileSync` import to `src/index.test.ts`. It is a `node:` builtin, so it goes in the first import group, above the existing `@modelcontextprotocol` import, with a blank line after it (ESLint `import/order` requires this):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
```

Then add this test inside the existing `describe("OpenLibraryServer", ...)` block, as the first `it` after `beforeEach`:

```ts
  it("reports the version from package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    const [implementation] = (Server as any).mock.calls[0];

    expect(implementation.version).toBe(pkg.version);
    expect(implementation.name).toBe("open-library-server");
  });
```

`beforeEach` calls `vi.clearAllMocks()` and then constructs a fresh `OpenLibraryServer`, so `mock.calls[0]` is that construction's arguments.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/index.test.ts -t "reports the version from package.json"`
Expected: FAIL — `expected '1.0.0' to be '1.0.2'`.

This failure is the drift itself, reproduced.

- [ ] **Step 3: Write the implementation**

In `src/index.ts`, add the builtin import at the top of the import block (line 2, directly under the shebang) followed by a blank line:

```ts
#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
```

Then, after the existing imports and before `class OpenLibraryServer`, add:

```ts
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
```

And replace line 29:

```ts
        version: pkg.version,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/index.test.ts -t "reports the version from package.json"`
Expected: PASS.

- [ ] **Step 5: Verify the full suite and lint still pass**

Run: `npm run build && npm run lint && npm run test:precommit`
Expected: build succeeds, lint clean, all tests pass.

The build step matters here: `vitest` also picks up the compiled tests under `build/`, so a stale `build/` will run the old assertions.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "fix: report the real package version instead of a hardcoded 1.0.0"
```

---

### Task 5: Release workflow

> **⚠️ Superseded — do not copy the YAML below.** `.github/workflows/publish-mcp.yml` as shipped is
> authoritative. Post-review changes: `mcp-publisher` install and `validate` moved *before*
> `npm publish` so a registry-side failure cannot leave npm published without a listing; the binary
> is pinned to `v1.8.1` and checksum-verified instead of piping `releases/latest` into `tar`; and the
> download block sets `set -euo pipefail` with `curl --fail`.

**Files:**

- Create: `.github/workflows/publish-mcp.yml`

**Interfaces:**

- Consumes: `scripts/assert-release-consistency.mjs` (Task 1), `server.json` (Task 2).
- Produces: the published npm package and registry listing.

- [ ] **Step 1: Create the workflow**

```yaml
name: Publish to MCP Registry

on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # npm trusted publishing AND mcp-publisher OIDC
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          registry-url: https://registry.npmjs.org
          package-manager-cache: false

      - name: Upgrade npm for trusted publishing
        run: npm install -g npm@latest

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm run test:precommit

      - name: Build
        run: npm run build

      - name: Assert release metadata is consistent
        run: node scripts/assert-release-consistency.mjs "${GITHUB_REF_NAME}"

      - name: Publish package to npm
        run: |
          VERSION="$(node -p "require('./package.json').version")"
          if npm view "mcp-open-library@${VERSION}" version >/dev/null 2>&1; then
            echo "mcp-open-library@${VERSION} is already on npm, skipping publish."
          else
            npm publish
          fi

      - name: Wait for npm to serve the new version
        run: |
          VERSION="$(node -p "require('./package.json').version")"
          for attempt in $(seq 1 12); do
            if npm view "mcp-open-library@${VERSION}" version >/dev/null 2>&1; then
              echo "mcp-open-library@${VERSION} is visible on npm."
              exit 0
            fi
            echo "Attempt ${attempt}/12: not visible yet, retrying in 5s..."
            sleep 5
          done
          echo "Timed out waiting for mcp-open-library@${VERSION} to appear on npm." >&2
          exit 1

      - name: Install mcp-publisher
        run: |
          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher

      - name: Validate server.json
        run: ./mcp-publisher validate

      - name: Authenticate to MCP Registry
        run: ./mcp-publisher login github-oidc

      - name: Publish server to MCP Registry
        run: ./mcp-publisher publish
```

Three things here are deliberate and must not be "simplified":

- `npm run test:precommit`, never `npm test` — see Global Constraints.
- The `npm publish` guard. Without it, a registry-side failure leaves you unable to re-run: the retry dies on `E409 version already exists` and the release has to be finished by hand.
- The propagation poll. The registry fetches `package.json` from npm to verify `mcpName`; losing that race surfaces as a misleading `Package validation failed`.

- [ ] **Step 2: Check the workflow parses**

Run: `npx --yes js-yaml .github/workflows/publish-mcp.yml > /dev/null && echo "YAML OK"`
Expected: `YAML OK`. Any indentation or syntax error prints a parse error and exits non-zero.

- [ ] **Step 3: Confirm the workflow cannot fire yet**

Run: `git tag --list 'v*'`
Expected: `v1.0.0`, `v1.0.1`, `v1.0.2` only. No new tag exists, so merging this workflow publishes nothing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish-mcp.yml
git commit -m "ci: publish to npm and the MCP registry on version tags"
```

---

### Task 6: Pull-request validation workflow

> **⚠️ Superseded — do not copy the YAML below.** `.github/workflows/validate-server-json.yml` as
> shipped is authoritative. Post-review changes: the `mcp-publisher` binary is pinned to `v1.8.1` and
> checksum-verified rather than pulled from `releases/latest`; the download block sets
> `set -euo pipefail` with `curl --fail`; and `CHANGELOG.md` was added to the `paths` filter once the
> consistency checker began reading it.

Catches a malformed listing before a tag is cut. Independently droppable — if you would rather rely solely on the tag-time assertion in Task 5, skip this task entirely; nothing else depends on it.

**Files:**

- Create: `.github/workflows/validate-server-json.yml`

**Interfaces:**

- Consumes: `scripts/assert-release-consistency.mjs` (Task 1), `server.json` (Task 2).
- Produces: nothing other tasks use.

- [ ] **Step 1: Create the workflow**

```yaml
name: Validate server.json

on:
  pull_request:
    paths:
      - server.json
      - package.json
      - scripts/**
      - .github/workflows/validate-server-json.yml

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:precommit

      - name: Assert release metadata is consistent
        run: node scripts/assert-release-consistency.mjs

      - name: Install mcp-publisher
        run: |
          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher

      - name: Validate server.json
        run: ./mcp-publisher validate
```

No tag argument is passed, so the checker skips the tag comparison and asserts only the four file-to-file invariants. This job needs no `id-token` permission — it never authenticates.

- [ ] **Step 2: Check the workflow parses and reproduce locally what the job will run**

```bash
npx --yes js-yaml .github/workflows/validate-server-json.yml > /dev/null && echo "YAML OK"
npm run test:precommit
node scripts/assert-release-consistency.mjs
```

Expected: `YAML OK`, tests pass, checker reports consistent.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/validate-server-json.yml
git commit -m "ci: validate server.json on pull requests"
```

---

### Task 7: Documentation

**Files:**

- Modify: `README.md` (add a registry install section under `## Installation`)
- Modify: `CHANGELOG.md` (add the missing `1.0.2` entry and an `Unreleased` section)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Add the registry section to `README.md`**

Insert directly under the `## Installation` heading, above `### Installing via Smithery`:

````markdown
### MCP Registry

This server is listed in the [official MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.8enSmith/mcp-open-library`. Clients that support the registry can install it by that name.

To inspect the published listing:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.8enSmith/mcp-open-library"
```
````

- [ ] **Step 2: Update `CHANGELOG.md`**

The file currently jumps from `1.0.1` straight back to `1.0.0` — the released `1.0.2` was never recorded. Add both sections directly above the existing `## [1.0.1]` heading:

```markdown
## [Unreleased]
### Added
- Published to the official MCP Registry as `io.github.8enSmith/mcp-open-library`
- Automated release pipeline: version tags publish to npm and the MCP Registry over OIDC

### Fixed
- Server now reports its real package version instead of a hardcoded `1.0.0`

## [1.0.2] - 2026-02-04
### Changed
- Updated dependencies
```

At release time the `Unreleased` heading becomes `## [1.0.3] - <date>`.

- [ ] **Step 3: Verify the docs render**

Run: `npx --yes markdownlint-cli2 README.md CHANGELOG.md 2>&1 | tail -20 || true`
Expected: no errors introduced by the new sections. Pre-existing warnings elsewhere in the files are not this task's concern.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document the MCP registry listing and release process"
```

---

## After the plan: releasing

These steps are **not** part of the implementation and must not be run by an implementing agent. They are the human release procedure, recorded here so it is not lost.

1. **Open and merge the PR.** Nothing publishes — `publish-mcp.yml` is tag-triggered only.

2. **Configure the npm trusted publisher.** npmjs.com → `mcp-open-library` → Settings → Trusted publisher:
   - Owner: `8enSmith`
   - Repository: `mcp-open-library`
   - Workflow: `publish-mcp.yml`

   Without this the publish step fails.

3. **Pre-flight the namespace.** The server name is permanent, so confirm the lowercase form is what the registry actually grants:

   ```bash
   mcp-publisher login github
   node -e "const t=require(require('os').homedir()+'/.config/mcp-publisher/token.json').token; console.log(JSON.parse(Buffer.from(t.split('.')[1],'base64url')))"
   ```

   Expected: a permissions claim covering `io.github.8enSmith/*` — note the capital `S`. This was run against the live registry during implementation and returned exactly that, overturning the original lowercase assumption; the resulting correction is commit `368b4b6`. If it ever shows a different case, correct `server.json` `name` and `package.json` `mcpName` together before releasing.

4. **Check `CHANGELOG.md` has a `## [Unreleased]` section** describing this release. Promoting it to
   `## [1.0.3] - <today>` is now automatic — `scripts/promote-changelog.mjs` runs from the `version`
   lifecycle hook. `npm version` fails if the heading is missing rather than releasing something
   undocumented. The canonical runbook now lives in the README's Development → Releasing section.

5. **Cut the release:**

   ```bash
   npm version patch
   git push --follow-tags
   ```

6. **Verify:**

   ```bash
   npm view mcp-open-library@1.0.3 mcpName
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.8enSmith/mcp-open-library"
   ```

   The first must print `io.github.8enSmith/mcp-open-library`; the second must return the listing.

If the registry step fails after npm succeeded, fix the cause and re-run the workflow from the Actions tab. The npm step self-skips, so the re-run picks up where it failed.
