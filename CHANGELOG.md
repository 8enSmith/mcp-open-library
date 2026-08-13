# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Security
- Transitive dependencies are now pinned to their [Socket registry](https://socket.dev/) drop-in replacements through `overrides` in `package.json`, with a matching `resolutions` block for Yarn and pnpm. 68 packages are declared, and the regenerated lockfile resolves 18 of them to `@socketregistry/*` — the other 50 are no longer in the tree at all. That is the substance of the change rather than a shortfall in it: the replacements are zero-dependency reimplementations, so the ES-shim micro-packages that existed only to satisfy one another fell out along with them, `es-abstract`, `call-bind`, `gopd`, `is-typed-array` and `which-typed-array` among them. Installed packages drop from 460 to 375 — the production tree from 108 to 92, the development tree from 352 to 283. Six replacements sit in the production tree (`es-define-property`, `es-set-tostringtag`, `hasown`, `object-assign`, `safer-buffer`, `side-channel`); the other twelve are dev-only, reached through the ESLint toolchain. The gain is that 85 fewer packages means 85 fewer maintainer accounts and publish pipelines able to reach an install, which is the surface a typosquat or a hijacked account actually travels through. Nothing changes at runtime, and nothing changes for anything installing this package — npm applies `overrides` only from the root project, never from a dependency's manifest

## [1.1.2] - 2026-08-11
### Security
- Updated `axios` to `^1.19.0` and `@modelcontextprotocol/sdk` to `^1.30.0`, and regenerated `package-lock.json` from scratch. The lockfile still held the versions resolved when each dependency was last installed, so transitive dependencies stayed on releases their own semver ranges had long since allowed patches for — `hono`, `fast-uri`, `ajv`, `follow-redirects`, `form-data` and the Vite/Vitest and ESLint toolchains. `axios@1.12.0` alone carried three critical advisories, the highest of which needed `1.15.2`. A Snyk scan of the production and development trees now reports no issues at any severity, down from 108

## [1.1.1] - 2026-08-11
### Fixed
- The server no longer advertises the `resources` capability it never implemented. Clients took the declaration at face value and called `resources/list`, `resources/templates/list` and `resources/read`, each of which returned a JSON-RPC `-32601 Method not found` because no handler was ever registered for them — the MCP Inspector showed a Resources tab and two failed requests on every connect. All three methods sit behind that single capability flag, so removing it stops clients asking

## [1.1.0] - 2026-08-10
### Added
- Tool: `search_books` - search across titles, authors, subjects, places, people, publishers and ISBNs, with `sort`, `language`, `limit` and `offset`. At least one search criterion is required
- `limit` and `offset` on `get_book_by_title` and `get_authors_by_name` — `limit` defaults to 10 with a maximum of 50, `offset` defaults to 0 with a maximum of 1000
- Requests now send a `User-Agent` identifying the server and its repository. (Open Library grants its higher 3 requests/second allowance only to clients that also send a contact email or phone number, so the default 1 request/second still applies here)
- Requests now time out after 15 seconds instead of hanging indefinitely
- Every tool now advertises a human-readable `title` and the `readOnlyHint` / `openWorldHint` annotations, which may allow a client to skip the confirmation prompt for these read-only lookups. Annotations are hints, and the MCP specification has clients treat them as untrusted unless the server is trusted, so the confirmation policy remains the client's decision
- Search results now carry `best_edition`: one edition of the work with its `isbn_13`/`isbn_10` where Open Library has them, plus its `edition_key`. Previously a search gave back only a *work* key, which no tool accepted — there was no route from a search result to an ISBN. The `edition_key` is an OLID that can be passed to `get_book_by_id` for the full edition record. ISBNs come from Open Library's nested `editions` sub-query rather than the work-level `isbn` field, which would return every edition's ISBN (6,113 for Pride and Prejudice) and inflate a page 35×

### Changed
- Invalid tool arguments now come back as a result with `isError: true` rather than a JSON-RPC `InvalidParams` error. The message is unchanged. Per the MCP specification, errors originating from a tool "SHOULD be reported inside the result object ... Otherwise, the LLM would not be able to see that an error occurred and self-correct" — a protocol error is raised by the client before the model ever sees it. Calling an unknown tool remains a protocol error, as the specification requires. Any unexpected exception inside a handler is likewise converted rather than escaping as a protocol error
- `get_book_by_title` returns an object `{ num_found, offset, limit, results }` rather than a bare array, so clients can tell how many matches exist beyond the page they were given. Previously it returned up to 100 results with no total
- `get_authors_by_name` returns an object `{ num_found, offset, limit, results }` rather than a bare array, and asks Open Library for one page instead of accepting its 100-result default. A broad name such as "smith" previously returned 100 authors — roughly 32KB into an assistant's context, against roughly 4.3KB for the default page of 10
- Search results now also carry `author_keys`, `ratings_average` and `ebook_access`. `author_keys` is an array of individual keys, each of which can be passed to `get_author_info` (which takes a single `author_key`)
- Search requests ask Open Library for only the fields used, cutting a typical `get_book_by_title` response from roughly 21KB to roughly 5.5KB
- `get_book_cover` and `get_author_photo` now check that the image exists and report `No cover image available ...` instead of returning a URL that resolves to a blank placeholder
- Upstream failures report a consistent `Open Library API error: <status> <reason>` including the HTTP status code, and all tools now set `isError` on failure (`get_book_by_id` previously did not)
- `get_book_by_id` flags both of its not-found paths the same way. Open Library reports a missing identifier either as a 404 or as a 200 carrying an empty record set; the latter previously came back without `isError`, so one outcome had two shapes
- `search_books` requires `language` to be a lowercase three-letter MARC code. Values such as `123` or `ENG` were previously forwarded to Open Library, which answered with no matches rather than reporting the code as malformed
- `get_book_cover` no longer accepts an explicit `size: null`; omit `size` to get the default `L`
- Each tool's JSON Schema is generated from its zod schema, so what clients are told a tool accepts can no longer drift from what is enforced

### Fixed
- `get_book_cover` and `get_author_photo` no longer report a cover as available when the request to the covers service actually failed. The existence check suppressed every HTTP status, so a 429 or 500 was indistinguishable from a hit and produced a URL; only a 404 now means "no image", and any other failing status is reported as an error

## [1.0.3] - 2026-08-09
### Added
- Published to the official MCP Registry as `io.github.8enSmith/mcp-open-library`
- Automated release pipeline: version tags publish to npm and the MCP Registry over OIDC

### Fixed
- Server now reports its real package version instead of a hardcoded `1.0.0`

## [1.0.2] - 2026-02-04
### Changed
- Updated dependencies

## [1.0.1] - 2026-02-04
### Changed
- Updated @modelcontextprotocol/sdk to v1.25.3 ([#30](https://github.com/8enSmith/mcp-open-library/pull/30))

## [1.0.0] - Initial Release
### Added
- MCP server implementation for Open Library API
- Tool: `get-book-by-title` - Search for books by title
- Tool: `get-book-by-id` - Get book details by Open Library ID
- Tool: `get-book-cover` - Get book cover image URLs
- Tool: `get-author-info` - Get author information
- Tool: `get-authors-by-name` - Search for authors by name
- Tool: `get-author-photo` - Get author photo URLs
- Tool: `health-check` - Check server health status
