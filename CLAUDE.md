# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nvm use                  # Node is pinned in .nvmrc (v22.21.1)
npm run build            # tsc -> build/, then chmod +x build/index.js
npm run watch            # tsc --watch
npm test                 # vitest in watch mode
npm run test:precommit   # vitest run (single pass) — what CI and the pre-commit hook use
npm run lint             # eslint src scripts
npm run lint:fix
npm run format           # prettier --write src/**/*.ts
npm run inspector        # MCP Inspector against build/index.js (build first)
```

Run a single test file or case:

```bash
npx vitest run src/tools/get-book-by-id/index.test.ts
npx vitest run -t "should return book details when given a valid OLID"
```

`vitest.config.ts` sets two things:

- `exclude` adds `build/**` to the defaults. Without it, `tsc` compiles the `.test.ts` files into `build/`, Vitest collects those copies alongside the sources, and every test runs twice locally — against stale compiled output, since `tsc` never removes artifacts for deleted source files. Collection is otherwise the Vitest default: `src/**/*.test.ts` plus the release scripts' `scripts/*.test.mjs`.
- `silent: "passed-only"` hides console output from passing tests. The handlers `console.error` in their catch blocks, so the error-path tests otherwise bury the results under stack traces. **Consequence:** a `console.log` added to debug a *passing* test prints nothing. Make the test fail, or run that file with `--silent=false`.

The husky pre-commit hook runs `lint-staged` (eslint --fix + prettier) followed by the **full** test suite, so commits are slow but pre-verified.

## Architecture

An MCP stdio server wrapping the Open Library HTTP API. Two layers:

**`src/index.ts`** — the `OpenLibraryServer` class. Creates one `axios` instance with `baseURL: https://openlibrary.org`, registers a `ListToolsRequestSchema` handler returning hand-written JSON Schema for all six tools, and a `CallToolRequestSchema` handler that `switch`es on tool name to a handler. Reads its version at runtime from `../package.json` relative to `import.meta.url` (resolves to the package root from `build/index.js`). The `run()` call is gated on `process.argv[1] === new URL(import.meta.url).pathname` so importing the module in tests doesn't start a transport.

**`src/tools/<tool-name>/`** — one directory per tool, each with `index.ts` (handler + its zod arg schema), optional `types.ts` (Open Library API response shapes), and `index.test.ts`. `src/tools/index.ts` re-exports every handler.

Handlers that call the API take `(args: unknown, axiosInstance)`; handlers that only build a covers.openlibrary.org URL (`get_author_photo`, `get_book_cover`) take `(args)` alone.

### Tool schemas are declared twice

Each tool's input contract exists in two places that must be kept in sync by hand: the JSON Schema in the `ListTools` handler in `src/index.ts`, and the zod schema inside the tool's own `index.ts` used for runtime validation. Changing one without the other silently diverges what clients are told from what is enforced.

Adding a tool means four edits: new directory under `src/tools/`, re-export from `src/tools/index.ts`, JSON Schema entry in the `ListTools` array, and a `case` in the `CallTool` switch. `src/index.test.ts` asserts the tool count, so it needs updating too.

### Error convention

Argument validation failures **throw** `new McpError(ErrorCode.InvalidParams, ...)` with the zod issues flattened into `path: message` pairs. Upstream API failures and empty results instead **return** a normal `CallToolResult` whose content is a plain-text message — never a thrown error. (Whether that result also sets `isError: true` is inconsistent across existing tools; follow the neighbouring tool you're editing.)

### ESM / module resolution

`"type": "module"` with `moduleResolution: nodenext`. Relative imports must carry the `.js` extension even in TypeScript source (`./types.js`, `./tools/index.js`).

## Lint

The flat config in `eslint.config.mjs` is what runs; `.eslintrc.json` is a leftover legacy config that ESLint 9 ignores. The rule that trips up most edits is `import/order`: builtin → external → internal → parent → sibling → index → object → type, alphabetised case-insensitively, with a blank line between groups.

## Releasing

`package.json`'s `version` is the single source of truth. A release is `npm version patch|minor|major` then `git push --follow-tags`. The `version` lifecycle hook rewrites `server.json` and promotes the `## [Unreleased]` CHANGELOG heading, so **changelog entries must be written under `## [Unreleased]` before bumping** or the command fails.

`npm version` is not idempotent — re-running it after a successful bump attempts the *next* version and leaves the manifests dirty. Recovery, the tag-move procedure when the publish workflow fails, and the full pipeline description are in README.md's Releasing section.

`scripts/assert-release-consistency.mjs` enforces that the git tag, `package.json`, `server.json` (both `version` and `packages[0].version`/`identifier`) and `CHANGELOG.md` all agree; it runs in the publish workflow and on PRs touching those files.
