# Work and editions tools

**Date:** 2026-11-21
**Status:** Approved

## Intent

`search_books` and `get_book_by_title` return an `open_library_work_key` for every result, and
`get_book_by_id` returns one for the edition it found, but no tool accepts it. An assistant can find
a book but cannot get the full picture of it: what the work is about, and which editions of it exist.

Two new tools close that gap, so the chain becomes:

```
search_books / get_book_by_title ──open_library_work_key──▶ get_work
                                                          └▶ get_work_editions ──edition_key──▶ get_book_by_id (olid)
```

## Goals

- `get_work`: the full work record for a work key, cleaned up for a model to read.
- `get_work_editions`: a paged, trimmed list of a work's editions, each carrying an `edition_key`
  that `get_book_by_id` accepts as `{ idType: "olid" }`.
- Keys round-trip. The work key exactly as `search_books`, `get_book_by_title` and `get_book_by_id`
  emit it (`/works/OL45804W`) is accepted, and every key these tools emit can be passed straight to
  the tool that consumes it.
- An assistant can discover the chain from tool descriptions alone.

## Non-goals

- **A single-edition tool.** `get_book_by_id` with `idType: "olid"` already returns one edition,
  with author names. See Approaches.
- **Filtering or sorting editions** by language, format or date. `/works/{id}/editions.json` offers
  no such parameters, and filtering one page client-side would make `num_found` lie.
- The ratings and bookshelves endpoints (`/works/{id}/ratings.json`, `/bookshelves.json`).
- Author details beyond name and key. `get_author_info` exists for that.

## Anti-goals

- Passing raw records through. An edition record is mostly `source_records`, `local_id` and
  revision stamps, and a page of 50 raw editions is ~37–39KB.
- A merged (redirected) work key reported as "not found", or a missing work reported as an empty
  result.
- Following redirects in a loop.

## Approaches

**A. Two new tools; `get_book_by_id` keeps handling single editions.** *Chosen.* `get_work` and
`get_work_editions` as below. To go deeper on one edition the assistant passes its `edition_key` to
`get_book_by_id`.

**B. Three tools, adding `get_edition` on `/books/{OLID}.json`** (what the Open Library docs call the
Editions API). It has a few fields `get_book_by_id`'s projection drops (first sentence, series,
contributors, description), but no author names, and it would give the assistant two tools that
look like they do the same job.

**C. A, plus widening `get_book_by_id`** to return those dropped fields. The `/api/volumes/brief`
response it already fetches carries the full edition record under `details.details`, so this needs
no new request. Rejected for now because it changes an existing tool's output; it can follow on its
own.

A was picked because the editions list already carries language and format, so the gap B and C
fill is small, and A adds no overlapping tool.

## Open Library behaviour this design relies on

Verified against the live API on 2026-11-21.

| Request                                         | Result                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /works/OL45804W.json`                      | 200, `type.key: "/type/work"`. Also carries a stray `location: "/works/OL45883W"`.                     |
| `GET /works/OL45883W.json`                      | 200, `type.key: "/type/redirect"`, `location: "/works/OL45804W"`. Not an HTTP redirect.                |
| `GET /works/OL999999999999W.json`               | 404                                                                                                     |
| `GET /works/OL45804W/editions.json`             | 200, `{ links, size: 161, entries: [50 edition records] }`                                              |
| `…/editions.json?limit=2&offset=5`              | 200, 2 entries, `links.prev`/`links.next`                                                               |
| `…/editions.json?limit=1000`                    | 200, 1000 entries (~690KB). `limit=5000` → 422. `limit=0` → silently the default 50.                    |
| `…/editions.json?offset=500` (past the end)     | 200, `entries: []`, `size` still 161                                                                    |
| `GET /works/OL45883W/editions.json` (redirect)  | **404**                                                                                                 |
| `GET /works/OL7353617M/editions.json` (edition) | 404                                                                                                     |
| `GET /search.json?q=key:/works/OL453936W&fields=author_name,author_key,edition_count` | One doc; `author_key`/`author_name` aligned and in the same order as the work record's authors (checked on *Good Omens*, two authors). |
| `GET /search.json?q=key:/works/OL921881W&fields=edition_count` | `edition_count: 0`, while `/works/OL921881W/editions.json` reports `size: 3`. The search index can lag the records. |

Shapes worth knowing:

- Work and edition records list authors by key only: work `authors[].author.key`
  (`/authors/OL34184A`), edition `authors[].key`. No names.
- `description` is either a string or `{ type: "/type/text", value }` (*Pride and Prejudice* uses
  the object form), the same pattern `get_author_info` already flattens for `bio`.
- `covers` arrays contain `-1` as a placeholder.
- Edition entries are in no useful order (neither date nor language).
- Field coverage on 50 *Pride and Prejudice* editions: `publish_date` 48, `publishers` 48,
  `languages` 43, `isbn_13` 30, `number_of_pages` 22, `physical_format` 19, `edition_name` 9,
  `isbn_10` 5. Absent fields are normal, not errors.

## Design

### Shared: work key handling (`src/utils/works.ts`)

**Input schema.** Both tools take `work_key`:

```ts
z.string()
  .regex(/^(?:\/works\/)?OL\d+W$/, { message: "work_key must be an Open Library work key, e.g. OL45804W or /works/OL45804W" })
  .describe("The Open Library work key, e.g. OL45804W. The /works/OL45804W form returned by search_books, get_book_by_title and get_book_by_id is also accepted.")
```

The optional prefix lives in the regex, not in a transform. `toInputSchema` publishes the regex as
`pattern`, so a client validating against the schema must accept both forms. A transform would also
be invisible in the published schema (see CLAUDE.md). The handler strips `/works/` after `parseArgs`.

**Output keys are bare:** `work_key: "OL45804W"`, `edition_key: "OL7353617M"`,
author `key: "OL34184A"`. Bare edition keys are what `get_book_by_id` needs for `olid`, and bare
author keys match `get_author_info`'s `^OL\d+A$`.

**Fetching a work with redirects.** A shared function fetches `/works/{key}.json` and resolves it to
one of: the work record plus its canonical key, not found, or a thrown error for anything else.

- Treat a record as a redirect **only when `type.key === "/type/redirect"`**, never because
  `location` is present. The canonical `OL45804W` carries a `location` pointing at `OL45883W`, which
  redirects back, so keying on `location` would loop.
- Follow at most **one** hop, using the key from `location`.
- After that hop, anything whose `type.key` is not `/type/work` (a second redirect, a deleted record)
  is **not found**.
- 404 is not found. Every other failure propagates.

### `get_work`

- **Title:** "Get work details". **Annotations:** `READ_ONLY_LOOKUP`.
- **Input:** `{ work_key }`.
- **Requests:**
  1. The shared work fetch above (two requests if the key was redirected).
  2. `GET /search.json` with `q=key:/works/{canonical key}`, `fields=author_key,author_name` and
     `limit=1`, for author names. It runs after step 1 so it uses the canonical key.
- **If step 2 fails or returns no doc:** degrade, don't fail. Return the work with authors as keys
  only, and log the error with `console.error`. The work record is what was asked for; names are
  enrichment. *(Designer's call.)*
- **No edition count.** The search index's `edition_count` can disagree with the editions endpoint
  (`OL921881W`: 0 against 3), and fetching the real count would cost a third request plus the
  editions endpoint's redirect handling. `get_work_editions`' `num_found` is the authoritative
  count. *(Designer's call.)*
- **Output** (`jsonResult`), omitting absent or empty fields:

  | Field                                                       | Source                                                                            |
  | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
  | `work_key`                                                  | Canonical key, bare. Differs from the input when the input was redirected.       |
  | `title`, `subtitle`                                         | Work record                                                                       |
  | `authors`                                                   | `[{ key, name? }]`. Keys from the work record (bare), in its order; `name` from the search doc, matched by key. |
  | `description`                                               | Flattened to a string                                                             |
  | `first_publish_date`                                        | As given (a free-text date such as `"1853"`)                                      |
  | `subjects`, `subject_places`, `subject_people`, `subject_times` | As given, uncapped (95 subjects for *Pride and Prejudice*)                   |
  | `cover_url`                                                 | First positive id in `covers` → `https://covers.openlibrary.org/b/id/{id}-M.jpg` |
  | `excerpts`                                                  | `[{ excerpt, comment? }]`, dropping the contributor's `author` key               |
  | `links`                                                     | `[{ title, url }]`, dropping `type`                                               |

  Dropped: `type`, `location`, `genres`/`literary_forms` (tag keys, not readable), `works`,
  revision and timestamp fields.

  `authors` is a list of objects rather than `search_books`' parallel `authors`/`author_keys`
  arrays, because a name can be missing when step 2 degrades, and parallel arrays would then be
  misaligned. *(Designer's call.)*

- **Description** (draft): "Get the full record for an Open Library work — the book as a whole,
  across all its editions: description, subjects, authors, first publication date, cover and
  external links. Takes the `open_library_work_key` returned by `search_books`, `get_book_by_title`
  or `get_book_by_id`. Use `get_work_editions` to list the work's editions."

### `get_work_editions`

- **Title:** "List editions of a work". **Annotations:** `READ_ONLY_LOOKUP`.
- **Input:** `{ work_key, limit, offset }`.
  - `limit`: integer 1–100, default 20. `limit=0` would silently become 50 upstream, hence `min(1)`.
    The trimmed projection measures ~270 bytes per edition (50 *Pride and Prejudice* editions:
    37KB raw → 13KB), so the default page is ~5KB and the maximum ~27KB. *(Designer's call:
    larger than search's 10/50 because there is no server-side filter, so finding a particular
    edition among *Pride and Prejudice*'s 4,042 means paging.)*
  - `offset`: integer ≥ 0, default 0, no maximum (past the end returns an empty page upstream).
  - Do **not** reuse `searchLimitSchema` / `searchOffsetSchema`. Their bounds (50, 1000) and
    descriptions (which mention `num_found` from search) are search-specific.
- **Request:** `GET /works/{key}/editions.json` with `params: { limit, offset }`.
- **On 404:** the key may be a merged work, since redirected keys 404 on this endpoint. Run the shared
  work fetch on the key:
  - It resolves to a different canonical key → retry the editions request once with that key.
  - Otherwise → not found.
- **Output** (`jsonResult`):

  ```json
  {
    "work_key": "OL45804W",
    "num_found": 161,
    "offset": 0,
    "limit": 20,
    "editions": [
      {
        "edition_key": "OL7353617M",
        "title": "Fantastic Mr. Fox",
        "publishers": ["Puffin"],
        "publish_date": "October 1, 1988",
        "languages": ["eng"],
        "isbn_13": "9780140328721",
        "isbn_10": "0140328726",
        "number_of_pages": 96,
        "cover_url": "https://covers.openlibrary.org/b/id/15152634-M.jpg"
      }
    ]
  }
  ```

  - `work_key` is the canonical key; `num_found` is upstream `size`.
  - Per edition, omitting absent fields: `edition_key` (bare), `title`, `subtitle`,
    `edition_name`, `publishers`, `publish_date`, `languages` (`/languages/eng` → `eng`, the same
    MARC codes `search_books`' `language` takes), `isbn_13` and `isbn_10` (the first of each
    array, passed through `normaliseIsbn`, which `src/utils/search.ts` must export),
    `number_of_pages`, `physical_format`, `cover_url` (first positive cover id, same URL form as
    `get_work`).
  - An empty page (past the end, or a work with no editions) is still a `jsonResult` with
    `editions: []`. `num_found` is what tells the assistant where the end is, so a bare
    "no editions" text would lose it. This stays within the error convention: it is not an error.
    *(Designer's call.)*
- **Description** (draft): "List the editions of an Open Library work — its specific printings,
  each with publisher, date, language, ISBNs, page count and format. Takes the
  `open_library_work_key` returned by `search_books`, `get_book_by_title` or `get_book_by_id`.
  Returns at most `limit` editions (default 20, maximum 100) with `num_found`, the total; page
  through them with `offset`. Editions are in Open Library's order, not by date, and cannot be
  filtered. Pass an edition's `edition_key` to `get_book_by_id` as `{ idType: "olid" }` for its full
  record."

### Errors

Following the convention in CLAUDE.md:

| Case                                                     | Result                                              |
| -------------------------------------------------------- | --------------------------------------------------- |
| `work_key` fails the regex                               | `InvalidArgumentsError` via `parseArgs`             |
| 404, or no `/type/work` after at most one redirect       | `errorTextResult("No work found for key: OL…W")`, using the key as given |
| Any other API failure on the work or editions request    | `toErrorResult(error, toolName)`                    |
| `get_work`'s author-name search fails                    | Degrade as above; not an error                      |

A work key names a thing, so a miss is a failed lookup (`errorTextResult`), not an empty search.

### Discoverability

Extend the descriptions of `search_books` and `get_book_by_title` with one sentence saying the
result's `open_library_work_key` can be passed to `get_work` and `get_work_editions`.
*(Designer's call.)* `get_book_by_id`'s description stays as it is.

### Request budget

`get_work` makes 2 requests (3 for a redirected key). `get_work_editions` makes 1 (3 for a
redirected key: editions 404, work fetch, retry; 4 if the work fetch itself hops). Open Library
allows 3 requests per second for an identified client, which `http.ts` already is.

## Files touched

- New: `src/tools/get-work/` and `src/tools/get-work-editions/` (each `index.ts`, `index.test.ts`,
  `types.ts` for the response shapes).
- New: `src/utils/works.ts` (+ test).
- `src/utils/search.ts`: export `normaliseIsbn`. The cover URL builder may be shared with
  `toBookInfo` too.
- `src/tools/registry.ts`: add both tools to `TOOLS`, after `getBookByIdTool`.
- `src/tools/search-books/index.ts`, `src/tools/get-book-by-title/index.ts`: description sentence.
- `src/index.test.ts`: refresh the schema snapshot (`npx vitest run -u`).
- `README.md`: Features list, the tools list under "Using with an MCP Client", an example input and
  output for each new tool in the existing style, and "the seven tools" → nine.
- `CLAUDE.md`: "All seven tools" → nine, and a short note on the redirect rule (keyed on `type`, one
  hop) and the editions endpoint 404ing for redirected keys.
- `CHANGELOG.md`: add a `## [Unreleased]` heading (none exists yet) with an `### Added` entry.

## Testing

Unit tests with a mocked `clients.api.get`, in the style of `src/tools/get-author-info/index.test.ts`,
asserting on the returned result rather than call counts. Cover each behaviour once,
table-driven where cases differ only in data:

- **Work key handling:** both input forms accepted; invalid keys rejected (`""`, an edition key
  `OL7353617M`, an author key, lowercase `ol45804w`).
- **`get_work`:** projection (object description flattened, `-1` covers skipped, bare keys, names
  matched to keys); redirect followed to the canonical key; a redirect to a redirect and a
  non-work type both reported as not found; 404 not found; author-name search failing degrades to
  keys; other API errors become `toErrorResult` text.
- **`get_work_editions`:** projection (language codes, ISBN normalisation, absent fields omitted,
  bare edition keys); `limit`/`offset` sent upstream and `num_found` taken from `size`; empty page;
  404 on a redirected key retried against the canonical key; 404 on a missing work; `limit` bounds
  (0, 101, 2.5) rejected; other API errors.

Before merging, run both tools once against the live API (for example through `npm run inspector`)
with `OL45804W`, the redirected `OL45883W` and `OL66554W`.

## Left to the builder

- Internal structure of `src/utils/works.ts` and the per-tool `types.ts`, keeping to functional style.
- Exact error and description wording, within the drafts above.
- README example payloads (take them from live responses).
