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

An MCP stdio server wrapping the Open Library HTTP API. Three layers:

**`src/index.ts`** — the `OpenLibraryServer` class. Builds the two `axios` clients via `createOpenLibraryClients`, then drives both request handlers from `TOOLS`: `ListTools` maps the registry through `toInputSchema`, and `CallTool` looks the tool up by name. Reads its version at runtime from `../package.json` relative to `import.meta.url` (resolves to the package root from `build/index.js`). The `run()` call is gated on `process.argv[1] === new URL(import.meta.url).pathname` so importing the module in tests doesn't start a transport.

**`src/tools/<tool-name>/`** — one directory per tool, each with `index.ts` (handler, zod arg schema, and the exported `ToolDefinition`), optional `types.ts` (Open Library API response shapes), and `index.test.ts`. `src/tools/registry.ts` collects the definitions into `TOOLS`; `src/tools/index.ts` re-exports everything.

**`src/utils/`** — `http.ts` (client factory; User-Agent and 15s timeout), `errors.ts` (`parseArgs`, `isNotFound`, `describeError`, `toErrorResult`), `results.ts` (`textResult`, `errorTextResult`, `jsonResult`), `schema.ts` (`toInputSchema`), `search.ts` (shared `/search.json` projection and paging schemas), `covers.ts` (cover existence check). `src/test-support/` holds test-only helpers — currently `axiosErrorWithStatus`, the one place the shape of an axios failure is constructed.

Every handler has the same signature: `(args: unknown, clients: OpenLibraryClients)`, where `clients` is `{ api, covers }` — `api` is based at `https://openlibrary.org`, `covers` at `https://covers.openlibrary.org`. The uniform signature is what lets `CallTool` dispatch generically.

### Tool schemas are generated from zod

A tool's input contract is declared **once**, as a zod schema. `toInputSchema` (`src/utils/schema.ts`) converts it with `z.toJSONSchema(schema, { io: "input" })` for the `ListTools` response. Two things to know:

- **`io: "input"` is mandatory.** The default (`"output"`) throws on any schema containing a transform, and marks defaulted fields as `required`.
- **`.refine()` is silently dropped.** Cross-field rules (like `search_books` requiring at least one criterion) must be repeated in the tool's `description`, or clients never learn about them.

Because `io: "input"` reports the *pre*-transform type, a `z.string().transform(...).pipe(z.enum([...]))` would publish a bare `{type: "string"}` and lose the enum. `get_book_by_id` therefore declares a plain enum and lowercases `idType` before calling `parseArgs`.

Adding a tool means two edits: a new directory under `src/tools/`, and an entry in `TOOLS` in `src/tools/registry.ts`. `src/index.test.ts` derives its assertions from `TOOLS`, so the only test change is refreshing the schema snapshot with `npx vitest run -u`.

### Error convention

The rule comes from the spec's `CallToolResult.isError` docs: errors originating from a tool "SHOULD be reported inside the result object, with `isError` set to `true`, *not* as an MCP protocol-level error response. Otherwise, the LLM would not be able to see that an error occurred and self-correct." Only failures in *finding* a tool stay protocol-level.

So: **the only thrown `McpError` is `MethodNotFound` for an unknown tool name**, in the `CallTool` handler. Everything else is a returned `CallToolResult`.

Handlers may still `throw` — `parseArgs` throws `InvalidArgumentsError` on bad arguments — but `CallTool` wraps every handler call and converts anything thrown into a tool error via `toToolError`. That catch is also the backstop for unexpected exceptions, so a bug in a handler degrades to `isError` rather than breaking the call. Handler unit tests therefore assert `rejects.toThrow(InvalidArgumentsError)`, while `src/index.test.ts` asserts the converted `isError` result at the boundary.

Use the helpers rather than hand-rolling results: `textResult` for an ordinary empty/negative result (no `isError` — "no books found" is a valid answer), `errorTextResult` for a tool-specific failure message (a 404 for a named key), and `toErrorResult(error, toolName)` inside a handler's `catch` for anything thrown by axios. `toErrorResult` logs and produces `Open Library API error: <status> <reason>`; all failure results set `isError: true`.

The line between the first two is *searching* versus *naming*: a search that matches nothing is a valid answer (`textResult`), while an identifier that resolves to nothing is a failed lookup (`errorTextResult`). `get_book_by_id` is the case to watch, because `/api/volumes/brief` reports a miss two ways — a 404, and a 200 carrying an empty `records` object — and both have to be flagged the same way or one logical outcome comes back with two different shapes.

### Cover existence checks

`resolveCoverUrl` (`src/utils/covers.ts`) is shared by `get_book_cover` and `get_author_photo`. It relies on axios's default behaviour of rejecting non-2xx responses:

- `?default=false` makes the covers service answer **404** instead of serving a blank placeholder, so a 404 is the "no image" answer — `textResult`, no `isError`.
- An image that exists answers **302** at the origin and resolves to **200** once axios follows the redirect to the Internet Archive, so the handler never observes the redirect itself.
- Every other status is a genuine failure and must surface as an error.

**Do not pass `validateStatus: () => true` here.** It resolves every status, which collapses the third case into the first: a 429 or 500 would be reported as an existing image on the strength of a request that never succeeded. `src/utils/covers.test.ts` asserts the request config carries no `validateStatus`, because that config — not the response handling — is where the bug lives.

### The search projection

`src/utils/search.ts` holds the one projection both `search_books` and `get_book_by_title` use — `SEARCH_FIELDS` (the `fields=` list) and `toBookInfo`. Change it and both tools change together.

**ISBNs come from the nested `editions` sub-query (`editions`, `editions.key`, `editions.isbn`), never the top-level `isbn` field.** This is the trap here, because `fields=isbn` looks like the obvious answer. It returns *every* edition's ISBN for the work — 6,113 for Pride and Prejudice — taking a 10-result page from ~2.7KB to ~97KB, and the resulting list is incoherent: unrelated printings in different languages, none of which is "the" ISBN. The `editions` block instead returns a single edition with its own identifiers, bounded regardless of how many editions exist, and tracks the query (search by ISBN and you get back the edition that matched). `src/utils/search.test.ts` asserts `SEARCH_FIELDS` does not contain `isbn`.

Open Library does not format ISBNs consistently within that field — `9780425038918`, `978-84-667-4056-8` and `9 780198 319207` all occur. `normaliseIsbn` strips separators before the length test, because a hyphenated ISBN-10 is also 13 characters and would otherwise be misfiled as an ISBN-13.

### Tool metadata

`ToolDefinition` carries a required `title` (human-readable display name) and optional `annotations`. All seven tools use the shared `READ_ONLY_LOOKUP` constant (`readOnlyHint: true, openWorldHint: true`) from `src/tools/types.ts`, which may allow clients to skip their confirmation prompt. Annotations are only *hints* — the spec has clients treat them as untrusted unless the server is trusted, so auto-approval is the client's decision, not something this server can assert. `destructiveHint` and `idempotentHint` are only meaningful when `readOnlyHint` is false, so they are deliberately omitted.

### ESM / module resolution

`"type": "module"` with `moduleResolution: nodenext`. Relative imports must carry the `.js` extension even in TypeScript source (`./types.js`, `./tools/index.js`).

## Lint

The flat config in `eslint.config.mjs` is what runs; `.eslintrc.json` is a leftover legacy config that ESLint 9 ignores. The rule that trips up most edits is `import/order`: builtin → external → internal → parent → sibling → index → object → type, alphabetised case-insensitively, with a blank line between groups.

## Releasing

`package.json`'s `version` is the single source of truth. A release is `npm version patch|minor|major` then `git push --follow-tags`. The `version` lifecycle hook rewrites `server.json` and promotes the `## [Unreleased]` CHANGELOG heading, so **changelog entries must be written under `## [Unreleased]` before bumping** or the command fails.

`npm version` is not idempotent — re-running it after a successful bump attempts the *next* version and leaves the manifests dirty. Recovery, the tag-move procedure when the publish workflow fails, and the full pipeline description are in README.md's Releasing section.

`scripts/assert-release-consistency.mjs` enforces that the git tag, `package.json`, `server.json` (both `version` and `packages[0].version`/`identifier`) and `CHANGELOG.md` all agree; it runs in the publish workflow and on PRs touching those files.
