# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Tool: `search_books` - search across titles, authors, subjects, places, people, publishers and ISBNs, with `sort`, `language`, `limit` and `offset`. At least one search criterion is required
- `limit` and `offset` on `get_book_by_title` (default 10, maximum 50)
- Requests now send a `User-Agent` identifying the server, which raises the Open Library rate limit from 1 to 3 requests per second
- Requests now time out after 15 seconds instead of hanging indefinitely
- Every tool now advertises a human-readable `title` and the `readOnlyHint` / `openWorldHint` annotations, so clients can skip the confirmation prompt for these read-only lookups
- Search results now carry `best_edition`: one edition of the work with its `isbn_13`/`isbn_10` where Open Library has them, plus its `edition_key`. Previously a search gave back only a *work* key, which no tool accepted — there was no route from a search result to an ISBN. The `edition_key` is an OLID that can be passed to `get_book_by_id` for the full edition record. ISBNs come from Open Library's nested `editions` sub-query rather than the work-level `isbn` field, which would return every edition's ISBN (6,113 for Pride and Prejudice) and inflate a page 35×

### Changed
- Invalid tool arguments now come back as a result with `isError: true` rather than a JSON-RPC `InvalidParams` error. The message is unchanged. Per the MCP specification, errors originating from a tool "SHOULD be reported inside the result object ... Otherwise, the LLM would not be able to see that an error occurred and self-correct" — a protocol error is raised by the client before the model ever sees it. Calling an unknown tool remains a protocol error, as the specification requires. Any unexpected exception inside a handler is likewise converted rather than escaping as a protocol error
- `get_book_by_title` returns an object `{ num_found, offset, limit, results }` rather than a bare array, so clients can tell how many matches exist beyond the page they were given. Previously it returned up to 100 results with no total
- Search results now also carry `author_keys`, `ratings_average` and `ebook_access`. `author_keys` can be passed straight to `get_author_info`
- Search requests ask Open Library for only the fields used, cutting a typical `get_book_by_title` response from roughly 21KB to roughly 5.5KB
- `get_book_cover` and `get_author_photo` now check that the image exists and report `No cover image available ...` instead of returning a URL that resolves to a blank placeholder
- Upstream failures report a consistent `Open Library API error: <status> <reason>` including the HTTP status code, and all tools now set `isError` on failure (`get_book_by_id` previously did not)
- `get_book_cover` no longer accepts an explicit `size: null`; omit `size` to get the default `L`
- Each tool's JSON Schema is generated from its zod schema, so what clients are told a tool accepts can no longer drift from what is enforced

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
