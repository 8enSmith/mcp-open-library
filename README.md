# MCP Open Library

[![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0.1%2Fservers%3Fsearch%3Dio.github.8enSmith%2Fmcp-open-library%26version%3Dlatest&query=%24.servers%5B0%5D.server.version&label=MCP%20Registry&prefix=v&color=blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.8enSmith/mcp-open-library)
[![Socket Badge](https://badge.socket.dev/npm/package/mcp-open-library)](https://socket.dev/npm/package/mcp-open-library)
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/8enSmith/mcp-open-library)](https://archestra.ai/mcp-catalog/8ensmith__mcp-open-library)
[![Listed on Spark](https://spark.entire.vc/badges/listed.svg)](https://spark.entire.vc/assets/vb-mcp-open-library?utm_source=github&utm_medium=readme)

A Model Context Protocol (MCP) server for the Open Library API that enables AI assistants to search for book and author information.

<a href="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library/badge" alt="mcp-open-library MCP server" />
</a>

## Overview

This project implements an MCP server that provides tools for AI assistants to interact with the [Open Library](https://openlibrary.org/). It allows searching the catalogue by title, author, subject and other fields, searching for authors by name, retrieving detailed author information using their Open Library key, and getting URLs for book covers and author photos. The server returns JSON projections of the Open Library responses rather than the raw payloads.

## Features

- **Book Search**: Search across titles, authors, subjects, places, people, publishers and ISBNs, with sorting and paging (`search_books`).
- **Book Search by Title**: Search for books using their title (`get_book_by_title`).
- **Author Search by Name**: Search for authors using their name, with paging (`get_authors_by_name`).
- **Get Author Details**: Retrieve detailed information for a specific author using their Open Library key (`get_author_info`).
- **Get Author Photo**: Get the URL for an author's photo using their Open Library ID (OLID) (`get_author_photo`).
- **Get Book Cover**: Get the URL for a book's cover image using various identifiers (ISBN, OCLC, LCCN, OLID, ID) (`get_book_cover`).
- **Get Book by ID**: Retrieve detailed book information using various identifiers (ISBN, LCCN, OCLC, OLID) (`get_book_by_id`).

Search results are paged — every search tool returns at most `limit` results (default 10, maximum 50) alongside `num_found`, the total number of matches, which you page through with `offset` (maximum 1000). The two cover tools check that an image actually exists and say so when it does not, rather than handing back a URL that resolves to a blank placeholder.

Every tool is a read-only lookup and advertises itself as such with the `readOnlyHint` and `openWorldHint` annotations, which may allow a client to skip the confirmation prompt it shows for tools that could change something. These are hints: the MCP specification has clients treat annotations as untrusted unless the server is trusted, so the confirmation policy is the client's to decide. Failures — an unreachable API, a rejected argument — come back as a tool result flagged `isError`, so an assistant can read what went wrong and correct its next call rather than the request failing outright.

## Installation

### MCP Registry

This server publishes to the official MCP Registry as
`io.github.8enSmith/mcp-open-library` from v1.0.3 onwards. Clients that
support the registry can install it by that name.

To inspect the published listing:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.8enSmith/mcp-open-library"
```

### Installing via Smithery

To install MCP Open Library for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@8enSmith/mcp-open-library):

```bash
npx -y @smithery/cli install @8enSmith/mcp-open-library --client claude
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/8enSmith/mcp-open-library.git
cd mcp-open-library

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Running the Server

  1. Ensure you are running node v22.21.1 (it'll probably work on a newer version of node but this is what Im using for this test). If you have `nvm` installed run `nvm use`.
  2. In the `mcp-open-library` root directory run `npm run build`
  3. Next run `npm run inspector`. Once built, click the URL with the `MCP_PROXY_AUTH_TOKEN` query string parameter to open the Inspector.
  4. In the Inspector, choose 'STDIO' transport
  5. Make sure the command is set to 'build/index.js'
  6. Click the 'Connect' button in the Inspector - you'll now connect to the server
  7. Click 'Tools' in the top right menu bar
  8. Try running a tool e.g. click get_book_by_title
  9. Search for a book e.g. In the title box enter 'The Hobbit' and then click 'Run Tool'. Server will then return book details.

### Using with an MCP Client

This server implements the Model Context Protocol, which means it can be used by any MCP-compatible AI assistant or client e.g. [Claude Desktop](https://modelcontextprotocol.io/quickstart/user). The server exposes the following tools:

- `search_books`: Search the catalogue by any combination of query, title, author, subject, place, person, publisher and ISBN
- `get_book_by_title`: Search for book information by title
- `get_authors_by_name`: Search for author information by name
- `get_author_info`: Get detailed information for a specific author using their Open Library Author Key
- `get_author_photo`: Get the URL for an author's photo using their Open Library Author ID (OLID)
- `get_book_cover`: Get the URL for a book's cover image using a specific identifier (ISBN, OCLC, LCCN, OLID, or ID)
- `get_book_by_id`: Get detailed book information using a specific identifier (ISBN, LCCN, OCLC, or OLID)

**Example `search_books` input:**

```json
{
  "author": "Ursula K. Le Guin",
  "subject": "fantasy",
  "sort": "old",
  "limit": 2
}
```

**Example `search_books` output:**

```json
{
  "num_found": 51,
  "offset": 0,
  "limit": 2,
  "results": [
    {
      "title": "A Wizard of Earthsea",
      "authors": ["Ursula K. Le Guin"],
      "first_publish_year": 1968,
      "open_library_work_key": "/works/OL59798W",
      "edition_count": 87,
      "author_keys": ["OL31353A"],
      "best_edition": {
        "edition_key": "OL5613890M"
      },
      "cover_url": "https://covers.openlibrary.org/b/id/13617691-M.jpg",
      "ratings_average": 3.95,
      "ebook_access": "borrowable"
    }
  ]
}
```

`best_edition` is one specific edition of the work — the one Open Library ranks best for your query — carrying that edition's own identifiers. Search results otherwise identify a **work** (`open_library_work_key`), which no tool accepts, so this is the route from a search hit to a concrete book.

Its `edition_key` is an OLID you can pass straight to `get_book_by_id` for the full edition record, including its complete ISBN arrays:

```json
{ "idType": "olid", "idValue": "OL5613890M" }
```

The `isbn_13` / `isbn_10` fields are omitted where Open Library holds no ISBN for that edition — as in the example above, and roughly a third of results — while `edition_key` is essentially always present. Where an edition lists several ISBNs of one kind, the first is reported; `get_book_by_id` returns them all.

The `search_books` tool accepts the following parameters:

- At least one of `q`, `title`, `author`, `subject`, `place`, `person`, `publisher` or `isbn` — the request is rejected without one, since an unfiltered search matches the entire catalogue. `q` takes a free-form Solr query such as `subject:cyberpunk AND first_publish_year:[1980 TO 1990]`
- `language`: Optional 3-letter MARC language code (e.g. `eng`, `fre`)
- `sort`: Optional ordering — `new`, `old`, `random`, `key`, `rating`, `readinglog`, `want_to_read`, `currently_reading`, `already_read` or `title`. Omit for relevance
- `limit`: Optional, 1–50, defaults to 10
- `offset`: Optional, 0–1000, defaults to 0

**Example `get_book_by_title` input:**

```json
{
  "title": "The Hobbit",
  "limit": 1
}
```

**Example `get_book_by_title` output:**

```json
{
  "num_found": 224,
  "offset": 0,
  "limit": 1,
  "results": [
    {
      "title": "The Hobbit",
      "authors": ["J.R.R. Tolkien"],
      "first_publish_year": 1937,
      "open_library_work_key": "/works/OL27482W",
      "edition_count": 481,
      "author_keys": ["OL26320A"],
      "best_edition": {
        "edition_key": "OL51709286M",
        "isbn_13": "9780395520215",
        "isbn_10": "0395520215"
      },
      "cover_url": "https://covers.openlibrary.org/b/id/14627509-M.jpg",
      "ratings_average": 4.29,
      "ebook_access": "borrowable"
    }
  ]
}
```

**Example `get_authors_by_name` input:**

```json
{
  "name": "J. R. R. Tolkien",
  "limit": 2
}
```

**Example `get_authors_by_name` output:**

Each result's `key` can be passed to `get_author_info` for that author's full
record. `alternate_names` is abridged here.

```json
{
  "num_found": 2,
  "offset": 0,
  "limit": 2,
  "results": [
    {
      "key": "OL26320A",
      "name": "J.R.R. Tolkien",
      "alternate_names": ["John Ronald Reuel Tolkien", "Tolkien"],
      "birth_date": "3 January 1892",
      "top_work": "The Hobbit",
      "work_count": 355
    },
    {
      "key": "OL332676A",
      "name": "J. R. R. Tolkien Centenary Conference (1992 Keble College, Oxford)",
      "top_work": "Proceedings of the J.R.R. Tolkien Centenary Conference, 1992",
      "work_count": 2
    }
  ]
}
```

**Example `get_author_info` input:**

```json
{
  "author_key": "OL26320A"
}
```

**Example `get_author_info` output:**

```json
{
  "name": "J. R. R. Tolkien",
  "personal_name": "John Ronald Reuel Tolkien",
  "birth_date": "3 January 1892",
  "death_date": "2 September 1973",
  "bio": "John Ronald Reuel Tolkien (1892-1973) was a major scholar of the English language, specializing in Old and Middle English. He served as the Rawlinson and Bosworth Professor of Anglo-Saxon and later the Merton Professor of English Language and Literature at Oxford University.",
  "alternate_names": ["John Ronald Reuel Tolkien"],
  "photos": [6791763],
  "key": "/authors/OL26320A",
  "remote_ids": {
    "viaf": "95218067",
    "wikidata": "Q892"
  },
  "revision": 43,
  "last_modified": {
    "type": "/type/datetime",
    "value": "2023-02-12T05:50:22.881"
  }
}
```

**Example `get_author_photo` input:**

```json
{
  "olid": "OL26320A"
}
```

**Example `get_author_photo` output:**

```text
https://covers.openlibrary.org/a/olid/OL26320A-L.jpg
```

When Open Library has no photo for that author, the tool says so instead of returning a URL:

```text
No author photo available for OLID OL99999999A.
```

**Example `get_book_cover` input:**

```json
{
  "key": "ISBN",
  "value": "9780547928227",
  "size": "L"
}
```

**Example `get_book_cover` output:**

```text
https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg
```

As with author photos, a book with no cover produces a message rather than a URL:

```text
No cover image available for OLID OL00000000M.
```

The `get_book_cover` tool accepts the following parameters:

- `key`: The type of identifier (one of: `ISBN`, `OCLC`, `LCCN`, `OLID`, or `ID`)
- `value`: The value of the identifier
- `size`: Optional cover size (`S` for small, `M` for medium, `L` for large, defaults to `L`)

**Example `get_book_by_id` input:**

```json
{
  "idType": "isbn",
  "idValue": "9780547928227"
}
```

**Example `get_book_by_id` output:**

```json
{
  "title": "The Hobbit",
  "authors": [
    "J. R. R. Tolkien"
  ],
  "publishers": [
    "Houghton Mifflin Harcourt"
  ],
  "publish_date": "October 21, 2012",
  "number_of_pages": 300,
  "isbn_13": [
    "9780547928227"
  ],
  "isbn_10": [
    "054792822X"
  ],
  "oclc": [
    "794607877"
  ],
  "olid": [
    "OL25380781M"
  ],
  "open_library_edition_key": "/books/OL25380781M",
  "open_library_work_key": "/works/OL45883W",
  "cover_url": "https://covers.openlibrary.org/b/id/8231496-M.jpg",
  "info_url": "https://openlibrary.org/books/OL25380781M/The_Hobbit",
  "preview_url": "https://archive.org/details/hobbit00tolkien"
}
```

The `get_book_by_id` tool accepts the following parameters:

- `idType`: The type of identifier (one of: `isbn`, `lccn`, `oclc`, `olid`)
- `idValue`: The value of the identifier

An example of this tool being used in Claude Desktop can be see here:

<img width="1132" alt="image" src="https://github.com/user-attachments/assets/0865904a-f984-4f7b-a27d-6397ac59d6d2" />

### Docker

You can test this MCP server using Docker. To do this first run:

```bash
docker build -t mcp-open-library .
docker run -p 8080:8080 mcp-open-library
```

You can then test the server running within Docker via the inspector e.g.

```bash
npm run inspector http://localhost:8080
```

## Development

### Project Structure

- `src/index.ts` - The MCP server: builds the HTTP clients and drives both request handlers
  from the tool registry
- `src/index.test.ts` - Tests for the server wiring, including a snapshot of the published
  tool schemas
- `src/tools/<tool-name>/` - One directory per tool, each containing `index.ts` (the
  handler, its Zod argument schema and its `ToolDefinition`), `index.test.ts`, and — for
  tools with a non-trivial API response — a `types.ts` describing that response shape
- `src/tools/registry.ts` - The `TOOLS` array, the single list of what the server exposes
- `src/tools/types.ts` - The `ToolDefinition` and `ToolHandler` contracts
- `src/utils/` - Shared plumbing: `http.ts` (the API and covers Axios clients), `errors.ts`
  (argument parsing and error results), `results.ts`, `schema.ts` (Zod → JSON Schema),
  `search.ts` (the shared search projection and paging schemas), `covers.ts`
- `scripts/` - Release automation (`sync-server-json.mjs`, `promote-changelog.mjs`,
  `assert-release-consistency.mjs`) and its tests

A tool's input contract is declared once, as a Zod schema. The JSON Schema that MCP clients
see is generated from it by `toInputSchema`, so the two cannot drift. Field descriptions come
from `.describe()` on the Zod schema. Note that `.refine()` constraints are dropped in
translation — a cross-field rule has to be stated in the tool's `description` too, or clients
will never learn about it.

Adding a tool means creating the directory and adding one entry to `TOOLS` in
`src/tools/registry.ts`. `src/index.test.ts` derives its expectations from that array, so the
only test change is an updated schema snapshot (`npx vitest run -u`).

### Available Scripts

- `npm run build` - Build the TypeScript code
- `npm run watch` - Watch for changes and rebuild
- `npm test` - Run the test suite in watch mode
- `npm run test:precommit` - Run the test suite once and exit
- `npm run lint` / `npm run lint:fix` - Lint `src` and `scripts` with ESLint
- `npm run format` - Format code with Prettier
- `npm run inspector` - Run the MCP Inspector against the server

### Running Tests

`npm test` starts Vitest in watch mode:

```bash
npm test
```

For a single pass — what the pre-commit hook and CI run — use:

```bash
npm run test:precommit
```

To run one file or one test case:

```bash
npx vitest run src/tools/get-book-by-id/index.test.ts
npx vitest run -t "should return book details when given a valid OLID"
```

### Releasing

Releases are automated. Pushing a `v*` tag triggers
[`publish-mcp.yml`](.github/workflows/publish-mcp.yml), which runs the checks, publishes the package
to npm, registers the new version with the MCP Registry, and then creates a GitHub Release using
that version's `CHANGELOG.md` section as the notes. Both npm and the registry authenticate over
GitHub OIDC, so there are no publishing secrets to manage.

`package.json`'s `version` is the single source of truth. `npm version` derives everything else from
it via a `version` lifecycle hook, so a release is one command:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

That single command bumps `package.json`, rewrites `server.json` to match, promotes the changelog's
`## [Unreleased]` heading to the new version and today's date, and commits the lot under one tag.

Two things to know before you run it:

- **Write your changelog entries first.** They go under a `## [Unreleased]` heading in
  [`CHANGELOG.md`](CHANGELOG.md) as you merge work. `npm version` fails if that heading is missing,
  rather than releasing something undocumented. If it does fail, undo the partial bump with
  `git restore --source=HEAD --staged --worktree package.json package-lock.json server.json`.
- **The working tree must be clean**, and the pre-commit hook (lint + full test suite) runs inside
  `npm version`.

CI re-asserts that the tag, `package.json`, `server.json` and `CHANGELOG.md` all agree before
anything is published — see `scripts/assert-release-consistency.mjs`. The same check runs on pull
requests that touch those files.

#### `npm version` is not a retry

Once it prints the new tag, the commit and tag exist and the release is done locally — the next step is
`git push --follow-tags`, **not** running `npm version` again. A second run attempts the *next*
version, and will fail on the missing `## [Unreleased]` heading (which the first run consumed). That
failure is safe by design, but it leaves `package.json`, `package-lock.json` and `server.json`
bumped and uncommitted. Undo with:

```bash
git restore --source=HEAD --staged --worktree package.json package-lock.json server.json
```

#### If the publish workflow fails

Re-running the job from the Actions tab only helps for a transient failure. GitHub runs the workflow
**as it existed at the tagged commit**, so a bug in the workflow itself or in `server.json` cannot be
fixed by a re-run — the fix has to be in the commit the tag points at.

Nothing is published until the workflow reaches its npm step, so if it failed before then, the
version is still free and you can move the tag:

```bash
# fix the problem on main and commit it first
VERSION="$(node -p "require('./package.json').version")"

git push origin ":v${VERSION}"            # delete the remote tag e.g. git push origin :v1.0.3
git tag -d "v${VERSION}"                  # delete it locally
git tag -a "v${VERSION}" -m "${VERSION}"  # re-tag at the fixed commit
git push origin "v${VERSION}"
```

The fix commit must leave `package.json` on that same version, or the consistency check will reject
the tag. If npm *did* already publish, do not reuse the version — that release is immutable. Bump to
the next patch instead; the guarded npm step means a re-run skips what already succeeded.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## Acknowledgments

- [Open Library API](https://openlibrary.org/developers/api)
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp)
