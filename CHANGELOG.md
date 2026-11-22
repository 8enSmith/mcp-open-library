# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-21
### Added
- `get_work`, which returns a work's full record: description, subjects, first publication date, cover, excerpts, links and authors with their names. The `open_library_work_key` returned by the search tools can now be looked up
- `get_work_editions`, which lists a work's editions with their `edition_key`, title, publishers, publish date, languages, ISBNs, page count, format and cover. Paged with `limit` (default 20, maximum 100) and `offset`; `num_found` is the authoritative total. Pass an `edition_key` to `get_book_by_id` with `{ "idType": "olid" }`
- Both tools accept a work key bare (`OL45804W`) or prefixed (`/works/OL45804W`), and follow a merged work to the surviving one instead of reporting it as not found
- The `search_books` and `get_book_by_title` descriptions now point to the two new tools

## [1.2.7] - 2026-11-21
### Added
- One-click install buttons for Cursor, VS Code and VS Code Insiders in the README, and a `claude mcp add` command for Claude Code

### Changed
- Updated `vitest` to `^5.1.1` and `@types/node` to `^22.20.5`. Development dependencies only

### Security
- Updated `axios` to `^1.21.1` and `zod` to `^4.6.6`, and refreshed `follow-redirects`, `fast-uri`, `body-parser` and `js-yaml` in the lockfile, clearing 18 high-severity Dependabot alerts. The raised minimums mean new installs get the fixed versions
- Refreshed the lockfile within the existing ranges, clearing the remaining 20 medium-severity and 1 low-severity alerts. `hono`, `ip-address` and `@hono/node-server` come in through `@modelcontextprotocol/sdk` and are not loaded over stdio; `minimatch` and `brace-expansion` are development dependencies

## [1.2.6] - 2026-10-22
### Security
- Updated `@modelcontextprotocol/sdk` to `^1.32.0`, fixing [CVE-2026-111767](https://github.com/advisories/GHSA-22jm-h49p-29qw) and [CVE-2026-111769](https://github.com/advisories/GHSA-6prh-2h8m-c8cw). Neither was reachable from this server, which runs only over stdio

## [1.2.5] - 2026-10-22
### Security
- `.nvmrc` now pins Node `v22.23.4`, which no longer trusts the eMudhra (emSign) intermediate certificate authorities compromised in October 2026. If you run the server yourself, use Node 22.23.4, 24.22.1 or 26.12.1 or later
- The `Dockerfile` now uses `debian:bookworm-slim` instead of `debian:bullseye-slim`, which has no fixed `ca-certificates` package and could no longer be built

## [1.2.4] - 2026-10-21
### Changed
- The publish workflow now waits up to 5 minutes, rather than 60 seconds, for npm to serve a new version before registering it with the MCP Registry

## [1.2.3] - 2026-10-20
### Added
- `CONTRIBUTING.md`, covering issues, bug reports, private security reports, development setup, conventions and what a pull request should pass

## [1.2.2] - 2026-08-29
### Removed
- The "Installing via Smithery" section of the README. Its command no longer worked, and [mcp.so](https://mcp.so/servers/mcp-open-library) had picked it up as this server's launch command, breaking the listing

## [1.2.1] - 2026-08-14
### Added
- `glama.json`, claiming maintainership of this server's [Glama](https://glama.ai) listing so its build settings can be edited and builds re-run

## [1.2.0] - 2026-08-13
### Fixed
- `npx mcp-open-library` and global installs now start the server. Previously they exited 0 without doing anything, because the entrypoint check compared the `bin` symlink with its resolved target. Checkouts under paths containing spaces are fixed too

### Changed
- The `bin` command and MCP `serverInfo.name` are now `mcp-open-library`, replacing `open-library-server`. The old `bin` never worked, so nothing depends on it

## [1.1.3] - 2026-08-13
### Security
- Transitive dependencies are overridden with their [Socket registry](https://socket.dev/) replacements, cutting installed packages from 460 to 375. Nothing changes at runtime or for projects installing this package

## [1.1.2] - 2026-08-11
### Security
- Updated `axios` to `^1.19.0` and `@modelcontextprotocol/sdk` to `^1.30.0`, and regenerated `package-lock.json`. Snyk now reports no issues, down from 108

## [1.1.1] - 2026-08-11
### Fixed
- The server no longer advertises the `resources` capability it never implemented, which made clients' resource requests fail with `-32601 Method not found`

## [1.1.0] - 2026-08-10
### Added
- Tool: `search_books` - search across titles, authors, subjects, places, people, publishers and ISBNs, with `sort`, `language`, `limit` and `offset`. At least one search criterion is required
- `limit` (default 10, maximum 50) and `offset` (default 0, maximum 1000) on `get_book_by_title` and `get_authors_by_name`
- Requests now send a `User-Agent` identifying the server and its repository
- Requests now time out after 15 seconds instead of hanging indefinitely
- Every tool now has a `title` and the `readOnlyHint` / `openWorldHint` annotations, which may let clients skip the confirmation prompt
- Search results now include `best_edition`: one edition's `isbn_13`/`isbn_10` and its `edition_key`, which `get_book_by_id` accepts

### Changed
- Invalid tool arguments now return a result with `isError: true` rather than a JSON-RPC `InvalidParams` error, so the model can see and correct them. Calling an unknown tool is still a protocol error
- `get_book_by_title` and `get_authors_by_name` return `{ num_found, offset, limit, results }` rather than a bare array, and fetch one page rather than up to 100 results
- Search results now include `author_keys`, `ratings_average` and `ebook_access`
- Search requests ask Open Library for only the fields used, cutting a typical `get_book_by_title` response from roughly 21KB to roughly 5.5KB
- `get_book_cover` and `get_author_photo` now report `No cover image available ...` instead of returning a URL to a blank placeholder
- Upstream failures report `Open Library API error: <status> <reason>`, and all tools now set `isError` on failure
- `get_book_by_id` reports both of Open Library's not-found responses (a 404, and a 200 with no records) as errors
- `search_books` requires `language` to be a lowercase three-letter MARC code
- `get_book_cover` no longer accepts `size: null`; omit `size` to get the default `L`
- Each tool's JSON Schema is generated from its zod schema, so it cannot drift from what is enforced

### Fixed
- `get_book_cover` and `get_author_photo` no longer report an image as available when the covers service fails, for example with a 429 or 500

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
