import { describe, expect, it } from "vitest";

import {
  SEARCH_FIELDS,
  searchLimitSchema,
  searchOffsetSchema,
  toBookInfo,
  toSearchResults,
} from "./search.js";

describe("SEARCH_FIELDS", () => {
  it("requests every field the projection reads", () => {
    expect(SEARCH_FIELDS.split(",")).toEqual([
      "key",
      "title",
      "author_name",
      "author_key",
      "first_publish_year",
      "edition_count",
      "cover_i",
      "ratings_average",
      "ebook_access",
      "editions",
      "editions.key",
      "editions.isbn",
    ]);
  });

  // The top-level `isbn` field returns every edition's ISBN — 6,113 of them for
  // Pride and Prejudice, taking a 10-result page from ~2.7KB to ~97KB. ISBNs
  // must come from the bounded `editions` sub-query instead.
  it("does not request the work-level isbn field", () => {
    expect(SEARCH_FIELDS.split(",")).not.toContain("isbn");
  });
});

describe("toBookInfo", () => {
  it("maps a fully populated document", () => {
    expect(
      toBookInfo({
        title: "Dune",
        author_name: ["Frank Herbert"],
        author_key: ["OL79034A"],
        first_publish_year: 1965,
        key: "/works/OL893415W",
        edition_count: 481,
        cover_i: 12345,
        ratings_average: 4.216666666,
        ebook_access: "borrowable",
        editions: {
          numFound: 141,
          docs: [
            {
              key: "/books/OL7500941M",
              isbn: ["9780425038918", "0425038912"],
            },
          ],
        },
      }),
    ).toEqual({
      title: "Dune",
      authors: ["Frank Herbert"],
      author_keys: ["OL79034A"],
      first_publish_year: 1965,
      open_library_work_key: "/works/OL893415W",
      edition_count: 481,
      best_edition: {
        edition_key: "OL7500941M",
        isbn_13: "9780425038918",
        isbn_10: "0425038912",
      },
      cover_url: "https://covers.openlibrary.org/b/id/12345-M.jpg",
      ratings_average: 4.22,
      ebook_access: "borrowable",
    });
  });

  it("omits optional fields that are absent", () => {
    expect(toBookInfo({ title: "Minimal", key: "/works/min" })).toEqual({
      title: "Minimal",
      authors: [],
      first_publish_year: null,
      open_library_work_key: "/works/min",
      edition_count: 0,
    });
  });

  it("omits an empty author_key array", () => {
    const result = toBookInfo({
      title: "X",
      key: "/works/x",
      author_key: [],
    });

    expect(result).not.toHaveProperty("author_keys");
  });

  it("keeps a zero rating rather than dropping it", () => {
    expect(
      toBookInfo({ title: "X", key: "/works/x", ratings_average: 0 }),
    ).toHaveProperty("ratings_average", 0);
  });
});

describe("toBookInfo best_edition", () => {
  const withEdition = (edition: { key?: string; isbn?: string[] }) =>
    toBookInfo({
      title: "X",
      key: "/works/x",
      editions: { docs: [edition] },
    }).best_edition;

  it("strips the /books/ prefix so the key works as an olid", () => {
    expect(withEdition({ key: "/books/OL7500941M" })?.edition_key).toBe(
      "OL7500941M",
    );
  });

  it("leaves a bare key untouched", () => {
    expect(withEdition({ key: "OL7500941M" })?.edition_key).toBe("OL7500941M");
  });

  it("splits the mixed isbn array by length", () => {
    expect(withEdition({ isbn: ["0425038912", "9780425038918"] })).toEqual({
      isbn_13: "9780425038918",
      isbn_10: "0425038912",
    });
  });

  it("handles an edition with only an ISBN-13", () => {
    expect(withEdition({ isbn: ["9780425038918"] })).toEqual({
      isbn_13: "9780425038918",
    });
  });

  it("handles an edition with only an ISBN-10", () => {
    expect(withEdition({ isbn: ["0425038912"] })).toEqual({
      isbn_10: "0425038912",
    });
  });

  it("keeps an ISBN-10 ending in a check character", () => {
    expect(withEdition({ isbn: ["054792822X"] })).toEqual({
      isbn_10: "054792822X",
    });
  });

  // Open Library returns these formats from the same field, and a hyphenated
  // ISBN-10 is also 13 characters, so separators have to go before the length
  // test can be trusted.
  it("normalises separators before classifying", () => {
    expect(withEdition({ isbn: ["978-84-667-4056-8"] })).toEqual({
      isbn_13: "9788466740568",
    });
    expect(withEdition({ isbn: ["9 780198 319207"] })).toEqual({
      isbn_13: "9780198319207",
    });
    expect(withEdition({ isbn: ["0-441-01359-7"] })).toEqual({
      isbn_10: "0441013597",
    });
  });

  it("ignores values that are not a valid ISBN length", () => {
    expect(withEdition({ isbn: ["671465759", "97893403311"] })).toBeUndefined();
  });

  it("takes the first of each kind when an edition lists several", () => {
    expect(
      withEdition({
        isbn: ["9780425038918", "9781444738209", "0425038912", "1444738208"],
      }),
    ).toEqual({ isbn_13: "9780425038918", isbn_10: "0425038912" });
  });

  // 32% of sampled results have an edition with no ISBN; the key alone is still
  // worth returning, since get_book_by_id resolves it.
  it("returns the key alone when the edition has no ISBNs", () => {
    expect(withEdition({ key: "/books/OL1M", isbn: [] })).toEqual({
      edition_key: "OL1M",
    });
  });

  it("is omitted when the edition carries nothing usable", () => {
    expect(withEdition({})).toBeUndefined();
  });

  it("is omitted when there is no editions block at all", () => {
    expect(toBookInfo({ title: "X", key: "/works/x" })).not.toHaveProperty(
      "best_edition",
    );
  });

  it("is omitted when the editions block has no docs", () => {
    expect(
      toBookInfo({ title: "X", key: "/works/x", editions: { numFound: 0 } }),
    ).not.toHaveProperty("best_edition");
  });
});

describe("toSearchResults", () => {
  it("reports the total match count alongside the page", () => {
    expect(
      toSearchResults(
        { numFound: 20970, docs: [{ title: "Dune", key: "/works/d" }] },
        10,
        20,
      ),
    ).toEqual({
      num_found: 20970,
      offset: 20,
      limit: 10,
      results: [
        {
          title: "Dune",
          authors: [],
          first_publish_year: null,
          open_library_work_key: "/works/d",
          edition_count: 0,
        },
      ],
    });
  });

  it("falls back to the page size when numFound is missing", () => {
    expect(
      toSearchResults({ docs: [{ title: "A", key: "/a" }] }, 10, 0).num_found,
    ).toBe(1);
  });
});

describe("paging schemas", () => {
  it("defaults the limit to 10 and caps it at 50", () => {
    expect(searchLimitSchema.parse(undefined)).toBe(10);
    expect(searchLimitSchema.safeParse(50).success).toBe(true);
    expect(searchLimitSchema.safeParse(51).success).toBe(false);
    expect(searchLimitSchema.safeParse(0).success).toBe(false);
  });

  it("defaults the offset to 0 and caps it at 1000", () => {
    expect(searchOffsetSchema.parse(undefined)).toBe(0);
    expect(searchOffsetSchema.safeParse(1000).success).toBe(true);
    expect(searchOffsetSchema.safeParse(1001).success).toBe(false);
    expect(searchOffsetSchema.safeParse(-1).success).toBe(false);
  });
});
