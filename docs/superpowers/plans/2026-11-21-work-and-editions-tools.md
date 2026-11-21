# Work and Editions Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `get_work` and `get_work_editions`, so the `open_library_work_key` the search tools return leads to the work's full record and a paged list of its editions.

**Architecture:** A shared `src/utils/works.ts` owns the work key schema, key and cover helpers, and the one-hop redirect-aware work fetch. Each tool is a directory under `src/tools/` following the existing handler/schema/`ToolDefinition` pattern, registered in `TOOLS`.

**Tech Stack:** TypeScript (ESM, `nodenext`), zod 4, axios, vitest, `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-11-21-work-and-editions-tools-design.md`. Its "Open Library behaviour" table holds the verified API facts this plan relies on.

## Global Constraints

- Relative imports carry `.js`. `import/order`: builtin → external → internal → parent → sibling → index → object → type, alphabetised, with a blank line between groups.
- Never add explanatory code comments (the user's rule). Keep existing comments. Machine-read comments (`eslint-disable` etc.) are fine.
- Functional style: plain functions and object literals, no classes.
- Tests check behaviour: assert on returned results and on the request a handler sends (`toHaveBeenCalledWith`), never on call counts. Use `it.each` tables for cases that differ only in data.
- Commit messages are one line with a conventional prefix (`feat:`, `docs:`, `test:`), no body and no trailers. The pre-commit hook runs lint-staged plus the full suite, so commits are slow.
- Schemas use no transforms. `work_key` is `z.string().regex(/^(?:\/works\/)?OL\d+W$/, { message: "work_key must be an Open Library work key, e.g. OL45804W or /works/OL45804W" })` with `.describe("The Open Library work key, e.g. OL45804W. The /works/OL45804W form returned by search_books, get_book_by_title and get_book_by_id is also accepted.")`. The handler strips the prefix after `parseArgs`.
- Every key emitted is bare: `OL45804W`, `OL7353617M`, `OL34184A`.
- Cover URL: `https://covers.openlibrary.org/b/id/{id}-M.jpg`, using the first positive id, which skips the `-1` placeholders.
- A missing work is `errorTextResult(\`No work found for key: ${work_key}\`)`, with `work_key` exactly as the caller passed it. Other upstream failures go through `toErrorResult(error, toolName)`.
- Omit absent or empty fields (`undefined`, `[]`) from every projection.
- Both tools use `annotations: READ_ONLY_LOOKUP`.

## Review Focus

1. A redirect record with no `location`, or one that isn't a `/works/OL…W` path → reported as not found, never as a request for `/works/undefined.json`. Pinned in Task 1.
2. A merged work whose canonical key *also* 404s on the editions endpoint → the not-found result, not an `Unexpected error`. Pinned in Task 3.
3. Legacy work author entries with no `author.key` → skipped, with the remaining authors still returned. Pinned in Task 2.
4. A 200 editions response missing `entries` or `size` → an empty page with `num_found: 0`, not a throw. Pinned in Task 3.
5. A search doc whose `author_name` is shorter than `author_key` → names are matched by key, and keys without a name are returned without one, never shifted onto another author. Pinned in Task 2.

---

### Task 1: Shared work lookup

**Files:**
- Create: `src/test-support/fake-clients.ts`
- Create: `src/utils/works.ts`
- Test: `src/utils/works.test.ts`

**Interfaces:**
- Consumes: `axiosErrorWithStatus(status, statusText?)` from `src/test-support/axios-error.ts`; `isNotFound` from `src/utils/errors.ts`; `OpenLibraryClients` from `src/utils/http.ts`.
- Produces:
  - `fakeClients(routes: Record<string, unknown>): { clients: OpenLibraryClients; get: Mock }`. `get(url)` resolves `{ data: routes[url] }`, rejects with the value when it is an `Error`, and rejects with `axiosErrorWithStatus(404)` when `url` has no route. `covers` is `{ head: vi.fn() }`.
  - `jsonBody(result: CallToolResult): any`, also in `src/test-support/fake-clients.ts`. It `JSON.parse`s `result.content[0].text`.
  - `workKeySchema` is the zod string from Global Constraints.
  - `toBareKey(key: string): string` returns the last path segment (`"/languages/eng"` → `"eng"`).
  - `firstCoverUrl(covers: number[] | undefined): string | undefined`.
  - `interface OpenLibraryWorkRecord`: `key`, `type: { key: string }`, `location?`, `title?`, `subtitle?`, `authors?: { author?: { key?: string } }[]`, `description?: string | { type: string; value: string }`, `first_publish_date?`, `subjects?`, `subject_places?`, `subject_people?`, `subject_times?` (all `string[]`), `covers?: number[]`, `excerpts?: { excerpt: string; comment?: string; author?: { key: string } }[]`, `links?: { title: string; url: string; type?: { key: string } }[]`.
  - `type WorkLookup = { found: true; key: string; work: OpenLibraryWorkRecord } | { found: false }`.
  - `fetchWork(api: AxiosInstance, workKey: string): Promise<WorkLookup>`. `workKey` is bare. The returned `key` is the bare canonical key.

- [ ] **Step 1: Write `fakeClients` and `jsonBody`, then the failing tests in `src/utils/works.test.ts`**

```ts
const work = (key: string, extra = {}) => ({ key: `/works/${key}`, type: { key: "/type/work" }, ...extra });
const redirect = (key: string, location?: string) => ({ key: `/works/${key}`, type: { key: "/type/redirect" }, location });

it.each(["OL45804W", "/works/OL45804W"])("workKeySchema accepts %s", (key) =>
  expect(workKeySchema.safeParse(key).success).toBe(true));
it.each(["", "OL7353617M", "OL34184A", "ol45804w", "/books/OL45804W", "OL45804W/editions"])(
  "workKeySchema rejects %j", (key) => expect(workKeySchema.safeParse(key).success).toBe(false));

it.each([
  ["/works/OL45804W", "OL45804W"], ["OL45804W", "OL45804W"], ["/books/OL7353617M", "OL7353617M"],
  ["/authors/OL34184A", "OL34184A"], ["/languages/eng", "eng"],
])("toBareKey(%s) is %s", (key, bare) => expect(toBareKey(key)).toBe(bare));

it.each([
  [[-1, 15152634, 8739161], "https://covers.openlibrary.org/b/id/15152634-M.jpg"],
  [[-1], undefined], [[], undefined], [undefined, undefined],
])("firstCoverUrl(%j)", (covers, url) => expect(firstCoverUrl(covers)).toBe(url));

it("returns a work under its own key even when it carries a stray location", async () => {
  const { clients } = fakeClients({ "/works/OL45804W.json": work("OL45804W", { location: "/works/OL45883W" }) });
  expect(await fetchWork(clients.api, "OL45804W")).toMatchObject({ found: true, key: "OL45804W" });
});

it("follows one redirect to the canonical work", async () => {
  const { clients } = fakeClients({
    "/works/OL45883W.json": redirect("OL45883W", "/works/OL45804W"),
    "/works/OL45804W.json": work("OL45804W", { title: "Fantastic Mr Fox" }),
  });
  expect(await fetchWork(clients.api, "OL45883W")).toEqual({
    found: true, key: "OL45804W", work: work("OL45804W", { title: "Fantastic Mr Fox" }),
  });
});

it.each([
  ["a 404", {}],
  ["a redirect to a redirect", { "/works/OL1W.json": redirect("OL1W", "/works/OL2W"), "/works/OL2W.json": redirect("OL2W", "/works/OL3W"), "/works/OL3W.json": work("OL3W") }],
  ["a redirect to a missing work", { "/works/OL1W.json": redirect("OL1W", "/works/OL2W") }],
  ["a redirect without a location", { "/works/OL1W.json": redirect("OL1W") }],
  ["a redirect to a non-work path", { "/works/OL1W.json": redirect("OL1W", "/books/OL2M"), "/books/OL2M.json": work("OL2M") }],
  ["a deleted record", { "/works/OL1W.json": { key: "/works/OL1W", type: { key: "/type/delete" } } }],
])("treats %s as not found", async (_, routes) => {
  const { clients } = fakeClients(routes);
  expect(await fetchWork(clients.api, "OL1W")).toEqual({ found: false });
});

it("rethrows failures other than 404", async () => {
  const failure = axiosErrorWithStatus(503, "Service Unavailable");
  const { clients } = fakeClients({ "/works/OL1W.json": failure });
  await expect(fetchWork(clients.api, "OL1W")).rejects.toBe(failure);
});
```

The `"a 404"` row has no route for `/works/OL1W.json`, so the 404 comes from `fakeClients`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/utils/works.test.ts`
Expected: FAIL, because `./works.js` does not exist.

- [ ] **Step 3: Implement `src/utils/works.ts`**

`fetchWork` requests `/works/${workKey}.json`. If `type.key` is `/type/work`, the work is found. If it is `/type/redirect` and `location` matches `^/works/OL\d+W$`, it fetches `toBareKey(location)` once and accepts only `/type/work`. Everything else is `{ found: false }`. A 404 on either request is `{ found: false }`, and any other error propagates.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/utils/works.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/test-support/fake-clients.ts src/utils/works.ts src/utils/works.test.ts
git commit -m "feat: add shared work lookup that follows one Open Library redirect"
```

---

### Task 2: `get_work`

**Files:**
- Create: `src/tools/get-work/index.ts`
- Create: `src/tools/get-work/types.ts`
- Test: `src/tools/get-work/index.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces; `parseArgs`, `toErrorResult` (`src/utils/errors.ts`); `errorTextResult`, `jsonResult` (`src/utils/results.ts`); `READ_ONLY_LOOKUP`, `ToolDefinition`, `ToolHandler` (`src/tools/types.ts`).
- Produces: `GetWorkArgsSchema` (`z.object({ work_key: workKeySchema })`), `handleGetWork: ToolHandler`, and `getWorkTool: ToolDefinition` with `name: "get_work"` and `title: "Get work details"`. The description is the spec's draft, verbatim:
  > Get the full record for an Open Library work — the book as a whole, across all its editions: description, subjects, authors, first publication date, cover and external links. Takes the `open_library_work_key` returned by `search_books`, `get_book_by_title` or `get_book_by_id`. Use `get_work_editions` to list the work's editions.
- `types.ts`: `WorkAuthor { key: string; name?: string }`; `WorkDetails` with the fields in the spec's `get_work` output table; and the search doc shape `{ author_key?: string[]; author_name?: string[] }`.

- [ ] **Step 1: Write the failing tests in `src/tools/get-work/index.test.ts`**

Use `fakeClients`. `PRIDE` is a `/works/OL66554W` record with `title: "Pride and Prejudice"`, `description: { type: "/type/text", value: "A novel of manners." }`, `first_publish_date: "1813"`, `subjects: ["Courtship"]`, `subject_places: ["England"]`, `covers: [-1, 14348537]`, `authors: [{ author: { key: "/authors/OL21594A" }, type: { key: "/type/author_role" } }]`, `excerpts: [{ excerpt: "It is a truth universally acknowledged…", comment: "first sentence", author: { key: "/people/seabelis" } }]`, `links: [{ title: "Wikipedia entry", url: "https://en.wikipedia.org/wiki/Pride_and_Prejudice", type: { key: "/type/link" } }]`, and noise: `genres`, `revision`, `last_modified`. `AUSTEN_SEARCH` is `{ docs: [{ author_key: ["OL21594A"], author_name: ["Jane Austen"] }] }`.

```ts
it("returns the cleaned-up work record", async () => {
  const { clients } = fakeClients({ "/works/OL66554W.json": PRIDE, "/search.json": AUSTEN_SEARCH });
  const result = await handleGetWork({ work_key: "OL66554W" }, clients);
  expect(result.isError).toBeUndefined();
  expect(jsonBody(result)).toEqual({
    work_key: "OL66554W", title: "Pride and Prejudice",
    authors: [{ key: "OL21594A", name: "Jane Austen" }],
    description: "A novel of manners.", first_publish_date: "1813",
    subjects: ["Courtship"], subject_places: ["England"],
    cover_url: "https://covers.openlibrary.org/b/id/14348537-M.jpg",
    excerpts: [{ excerpt: "It is a truth universally acknowledged…", comment: "first sentence" }],
    links: [{ title: "Wikipedia entry", url: "https://en.wikipedia.org/wiki/Pride_and_Prejudice" }],
  });
});

it.each(["OL66554W", "/works/OL66554W"])("accepts the work key as %s", async (work_key) => {
  const { clients } = fakeClients({ "/works/OL66554W.json": PRIDE, "/search.json": AUSTEN_SEARCH });
  expect(jsonBody(await handleGetWork({ work_key }, clients)).work_key).toBe("OL66554W");
});

it("follows a merged work and looks up names under the canonical key", async () => {
  const { clients, get } = fakeClients({
    "/works/OL45883W.json": { key: "/works/OL45883W", type: { key: "/type/redirect" }, location: "/works/OL66554W" },
    "/works/OL66554W.json": PRIDE, "/search.json": AUSTEN_SEARCH,
  });
  expect(jsonBody(await handleGetWork({ work_key: "OL45883W" }, clients)).work_key).toBe("OL66554W");
  expect(get).toHaveBeenCalledWith("/search.json", {
    params: { q: "key:/works/OL66554W", fields: "author_key,author_name", limit: 1 },
  });
});

it.each([
  ["the name lookup fails", axiosErrorWithStatus(500, "Internal Server Error")],
  ["the name lookup finds no doc", { docs: [] }],
])("returns authors as keys when %s", async (_, search) => {
  const { clients } = fakeClients({ "/works/OL66554W.json": PRIDE, "/search.json": search });
  const result = await handleGetWork({ work_key: "OL66554W" }, clients);
  expect(result.isError).toBeUndefined();
  expect(jsonBody(result).authors).toEqual([{ key: "OL21594A" }]);
});

it("skips author entries without a key and keeps names matched by key", async () => {
  const work = { ...PRIDE, authors: [{ author: { key: "/authors/OL1A" } }, {}, { author: { key: "/authors/OL2A" } }] };
  const { clients } = fakeClients({
    "/works/OL66554W.json": work,
    "/search.json": { docs: [{ author_key: ["OL1A", "OL2A"], author_name: ["First"] }] },
  });
  expect(jsonBody(await handleGetWork({ work_key: "OL66554W" }, clients)).authors)
    .toEqual([{ key: "OL1A", name: "First" }, { key: "OL2A" }]);
});

it("omits fields the record lacks", async () => {
  const { clients } = fakeClients({ "/works/OL1W.json": { key: "/works/OL1W", type: { key: "/type/work" }, title: "Bare" }, "/search.json": { docs: [] } });
  expect(jsonBody(await handleGetWork({ work_key: "OL1W" }, clients))).toEqual({ work_key: "OL1W", title: "Bare" });
});

it("reports a missing work as a failed lookup", async () => {
  const result = await handleGetWork({ work_key: "/works/OL999W" }, fakeClients({}).clients);
  expect(result).toEqual({ isError: true, content: [{ type: "text", text: "No work found for key: /works/OL999W" }] });
});

it("reports other API failures", async () => {
  const { clients } = fakeClients({ "/works/OL1W.json": axiosErrorWithStatus(503, "Service Unavailable") });
  const result = await handleGetWork({ work_key: "OL1W" }, clients);
  expect(result.isError).toBe(true);
  expect(result.content).toEqual([{ type: "text", text: "Open Library API error: 503 Service Unavailable" }]);
});

it("rejects a key that is not a work key", async () => {
  await expect(handleGetWork({ work_key: "OL7353617M" }, fakeClients({}).clients)).rejects.toThrow(InvalidArgumentsError);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/tools/get-work/index.test.ts`
Expected: FAIL, because `./index.js` does not exist.

- [ ] **Step 3: Implement `src/tools/get-work/types.ts` and `index.ts`**

The name lookup is `clients.api.get("/search.json", { params: { q: \`key:/works/${key}\`, fields: "author_key,author_name", limit: 1 } })`, in its own `try`/`catch`. Its failure logs with `console.error` and yields no names. Build the key→name map by zipping `author_key[i]` with `author_name[i]`, skipping indexes that have no name. The handler's outer `catch` sends everything to `toErrorResult(error, "get_work")`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/tools/get-work/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-work
git commit -m "feat: add get_work tool for full Open Library work records"
```

---

### Task 3: `get_work_editions`

**Files:**
- Modify: `src/utils/search.ts`, to export `normaliseIsbn` (currently module-private)
- Create: `src/tools/get-work-editions/index.ts`
- Create: `src/tools/get-work-editions/types.ts`
- Test: `src/tools/get-work-editions/index.test.ts`

**Interfaces:**
- Consumes: Task 1's `workKeySchema`, `toBareKey`, `firstCoverUrl`, `fetchWork`, `fakeClients`; `normaliseIsbn(value: string): string` from `src/utils/search.ts`; the same errors, results and types helpers as Task 2, plus `isNotFound`.
- Produces:
  - `DEFAULT_EDITIONS_LIMIT = 20` and `MAX_EDITIONS_LIMIT = 100`.
  - `GetWorkEditionsArgsSchema`: `work_key`; `limit` as `z.number().int().min(1).max(100).default(20)`; `offset` as `z.number().int().min(0).default(0)`. Each gets a `.describe()` naming its bounds and default.
  - `handleGetWorkEditions: ToolHandler`.
  - `getWorkEditionsTool` with `name: "get_work_editions"` and `title: "List editions of a work"`. The description is the spec's draft, verbatim:
    > List the editions of an Open Library work — its specific printings, each with publisher, date, language, ISBNs, page count and format. Takes the `open_library_work_key` returned by `search_books`, `get_book_by_title` or `get_book_by_id`. Returns at most `limit` editions (default 20, maximum 100) with `num_found`, the total; page through them with `offset`. Editions are in Open Library's order, not by date, and cannot be filtered. Pass an edition's `edition_key` to `get_book_by_id` as `{ idType: "olid" }` for its full record.
- `types.ts`: `OpenLibraryEditionsResponse { size?: number; entries?: OpenLibraryEditionRecord[] }`; `OpenLibraryEditionRecord` (the fields read: `key`, `title`, `subtitle`, `edition_name`, `publishers`, `publish_date`, `languages?: { key: string }[]`, `isbn_13`, `isbn_10`, `number_of_pages`, `physical_format`, `covers`); `EditionSummary`; and `WorkEditions { work_key; num_found; offset; limit; editions: EditionSummary[] }`.

- [ ] **Step 1: Write the failing tests in `src/tools/get-work-editions/index.test.ts`**

`PUFFIN` is a `/books/OL7353617M` record with `title: "Fantastic Mr. Fox"`, `edition_name: "1st Puffin ed."`, `publishers: ["Puffin"]`, `publish_date: "October 1, 1988"`, `languages: [{ key: "/languages/eng" }]`, `isbn_13: ["978-0-14-032872-1"]`, `isbn_10: ["0140328726"]`, `number_of_pages: 96`, `physical_format: "Paperback"`, `covers: [15152634, 8739161, -1]`, and noise: `source_records`, `local_id`, `revision`, `works`, `type`. `HEBREW` is `{ key: "/books/OL57649219M", title: "Mar shuʻal ha-mehulal", type: { key: "/type/edition" }, languages: [{ key: "/languages/heb" }] }`. `PAGE` is `{ size: 161, links: { self: "…" }, entries: [PUFFIN, HEBREW] }`.

```ts
const EDITIONS = "/works/OL45804W/editions.json";

it("returns a trimmed page of editions", async () => {
  const { clients } = fakeClients({ [EDITIONS]: PAGE });
  const result = await handleGetWorkEditions({ work_key: "/works/OL45804W" }, clients);
  expect(result.isError).toBeUndefined();
  expect(jsonBody(result)).toEqual({
    work_key: "OL45804W", num_found: 161, offset: 0, limit: 20,
    editions: [
      { edition_key: "OL7353617M", title: "Fantastic Mr. Fox", edition_name: "1st Puffin ed.",
        publishers: ["Puffin"], publish_date: "October 1, 1988", languages: ["eng"],
        isbn_13: "9780140328721", isbn_10: "0140328726", number_of_pages: 96,
        physical_format: "Paperback", cover_url: "https://covers.openlibrary.org/b/id/15152634-M.jpg" },
      { edition_key: "OL57649219M", title: "Mar shuʻal ha-mehulal", languages: ["heb"] },
    ],
  });
});

it.each([
  [{}, { limit: 20, offset: 0 }],
  [{ limit: 5, offset: 10 }, { limit: 5, offset: 10 }],
])("pages upstream with %j", async (paging, params) => {
  const { clients, get } = fakeClients({ [EDITIONS]: PAGE });
  const result = jsonBody(await handleGetWorkEditions({ work_key: "OL45804W", ...paging }, clients));
  expect(get).toHaveBeenCalledWith(EDITIONS, { params });
  expect(result).toMatchObject(params);
});

it.each([
  ["past the end", { size: 161, entries: [] }, 161],
  ["missing entries and size", {}, 0],
])("returns an empty page when the response is %s", async (_, data, num_found) => {
  const { clients } = fakeClients({ [EDITIONS]: data });
  const result = await handleGetWorkEditions({ work_key: "OL45804W", offset: 500 }, clients);
  expect(result.isError).toBeUndefined();
  expect(jsonBody(result)).toMatchObject({ num_found, editions: [] });
});

it("retries a merged work under its canonical key", async () => {
  const { clients } = fakeClients({
    "/works/OL45883W.json": { key: "/works/OL45883W", type: { key: "/type/redirect" }, location: "/works/OL45804W" },
    "/works/OL45804W.json": { key: "/works/OL45804W", type: { key: "/type/work" } },
    [EDITIONS]: PAGE,
  });
  const result = jsonBody(await handleGetWorkEditions({ work_key: "OL45883W" }, clients));
  expect(result).toMatchObject({ work_key: "OL45804W", num_found: 161 });
  expect(result.editions).toHaveLength(2);
});

it.each([
  ["no work exists", {}],
  ["the work exists but its editions 404", { "/works/OL999W.json": { key: "/works/OL999W", type: { key: "/type/work" } } }],
  ["the canonical work's editions also 404", {
    "/works/OL999W.json": { key: "/works/OL999W", type: { key: "/type/redirect" }, location: "/works/OL45804W" },
    "/works/OL45804W.json": { key: "/works/OL45804W", type: { key: "/type/work" } },
  }],
])("reports a missing work when %s", async (_, routes) => {
  const result = await handleGetWorkEditions({ work_key: "OL999W" }, fakeClients(routes).clients);
  expect(result).toEqual({ isError: true, content: [{ type: "text", text: "No work found for key: OL999W" }] });
});

it("reports other API failures", async () => {
  const { clients } = fakeClients({ [EDITIONS]: axiosErrorWithStatus(503, "Service Unavailable") });
  const result = await handleGetWorkEditions({ work_key: "OL45804W" }, clients);
  expect(result.isError).toBe(true);
  expect(result.content).toEqual([{ type: "text", text: "Open Library API error: 503 Service Unavailable" }]);
});

it.each([{ limit: 0 }, { limit: 101 }, { limit: 2.5 }, { offset: -1 }])(
  "rejects paging %j", async (paging) => {
    await expect(handleGetWorkEditions({ work_key: "OL45804W", ...paging }, fakeClients({}).clients))
      .rejects.toThrow(InvalidArgumentsError);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/tools/get-work-editions/index.test.ts`
Expected: FAIL, because `./index.js` does not exist.

- [ ] **Step 3: Export `normaliseIsbn` from `src/utils/search.ts` and implement `types.ts` and `index.ts`**

Request `clients.api.get(\`/works/${key}/editions.json\`, { params: { limit, offset } })`. On a 404, call `fetchWork(clients.api, key)`. If that returns `found` with a different `key`, repeat the editions request once with it. Every other outcome, including a 404 on the repeat, is the not-found result. Each ISBN is the first element of its array after `normaliseIsbn`. `num_found` is `size ?? 0` and `editions` is `(entries ?? []).map(...)`. Other errors go to `toErrorResult(error, "get_work_editions")`.

- [ ] **Step 4: Run the tests, plus the search tests the export touches**

Run: `npx vitest run src/tools/get-work-editions/index.test.ts src/utils/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/search.ts src/tools/get-work-editions
git commit -m "feat: add get_work_editions tool listing a work's editions"
```

---

### Task 4: Expose the tools and document them

**Files:**
- Modify: `src/tools/registry.ts`, inserting `getWorkTool, getWorkEditionsTool` after `getBookByIdTool` in `TOOLS`
- Modify: `src/tools/index.ts`, adding `export * from "./get-work/index.js";` and `export * from "./get-work-editions/index.js";`
- Modify: `src/tools/search-books/index.ts` and `src/tools/get-book-by-title/index.ts` (`description`)
- Modify: `src/__snapshots__/index.test.ts.snap`, regenerated rather than edited by hand
- Modify: `README.md`, `CLAUDE.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `getWorkTool` (Task 2) and `getWorkEditionsTool` (Task 3).
- Produces: nothing later tasks use.

- [ ] **Step 1: Register both tools and extend the two search descriptions**

Append this sentence to the end of both the `search_books` and `get_book_by_title` descriptions:

> Each result's `open_library_work_key` can be passed to `get_work` for the work's description, subjects and authors, or to `get_work_editions` to list its editions.

- [ ] **Step 2: Run the server tests and confirm only the snapshot fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL only in "matches the published tool schemas". Every other `ListTools` test passes, which proves both definitions have a unique name, a title, a description, an object schema and `READ_ONLY_LOOKUP`.

- [ ] **Step 3: Refresh the snapshot and inspect the diff**

Run: `npx vitest run -u src/index.test.ts && git diff src/__snapshots__/index.test.ts.snap`
Expected: the two new tools appear with `work_key` required and `"pattern": "^(?:\\/works\\/)?OL\\d+W$"`. `get_work_editions` has `limit` as an integer with `minimum: 1`, `maximum: 100`, `default: 20`, and `offset` with `minimum: 0`, `default: 0`, neither of them required. The only other changes are the two extended descriptions.

- [ ] **Step 4: Update the docs**

- `README.md`:
  - Add Features bullets **Get Work Details** (`get_work`) and **List Work Editions** (`get_work_editions`).
  - Add both tools to the list under "Using with an MCP Client".
  - Add an example input and output for each, in the existing style, taken from the live responses in Step 6.
  - Change "the seven tools below" to nine.
  - Add a sentence to the paging paragraph: `get_work_editions` pages with `limit` (default 20, maximum 100) and `offset` (no maximum), reporting `num_found`.
- `CLAUDE.md`:
  - Change "All seven tools" to nine.
  - Add `works.ts` to the `src/utils/` list and `fakeClients` to the `src/test-support/` sentence.
  - Add a short `### Works and redirects` section: a merged work returns 200 with `type: /type/redirect` (not an HTTP redirect); redirects are detected on `type.key` and never on `location`, because canonical records carry stray `location`s that point back; only one hop is followed; `/works/{key}/editions.json` 404s for a redirected key, so `get_work_editions` falls back to `fetchWork` and retries.
- `CHANGELOG.md`: insert `## [Unreleased]` above `## [1.2.7]`, with an `### Added` entry describing both tools, the accepted key forms and the chain to `get_book_by_id`.

- [ ] **Step 5: Run the full suite, lint and build**

Run: `npm run test:precommit && npm run lint && npm run build`
Expected: all tests pass, no lint errors, and `build/index.js` is written.

- [ ] **Step 6: Check both tools against the live API**

Run (from the repo root, after the build):

```bash
node --input-type=module -e '
import { createOpenLibraryClients } from "./build/utils/http.js";
import { handleGetWork } from "./build/tools/get-work/index.js";
import { handleGetWorkEditions } from "./build/tools/get-work-editions/index.js";
const c = createOpenLibraryClients("dev");
for (const [h, a] of [[handleGetWork, { work_key: "OL45804W" }], [handleGetWork, { work_key: "OL45883W" }],
  [handleGetWorkEditions, { work_key: "/works/OL45883W", limit: 2 }], [handleGetWorkEditions, { work_key: "OL66554W", limit: 3 }]])
  console.log(JSON.stringify(a), (await h(a, c)).content[0].text.slice(0, 600), "\n");
'
```

Expected:
- Both `get_work` calls report `work_key: "OL45804W"`, `title: "Fantastic Mr Fox"` and `authors: [{ key: "OL34184A", name: "Roald Dahl" }]`.
- The redirected `get_work_editions` call reports `work_key: "OL45804W"`, `num_found` ≥ 161 and two editions with bare `edition_key`s.
- `OL66554W` reports `num_found` ≥ 4042.

Use these outputs for the README examples.

- [ ] **Step 7: Commit**

```bash
git add src/tools/registry.ts src/tools/index.ts src/tools/search-books/index.ts src/tools/get-book-by-title/index.ts src/__snapshots__/index.test.ts.snap README.md CLAUDE.md CHANGELOG.md
git commit -m "feat: register get_work and get_work_editions and document them"
```
