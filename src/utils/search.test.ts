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
    ]);
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
      }),
    ).toEqual({
      title: "Dune",
      authors: ["Frank Herbert"],
      author_keys: ["OL79034A"],
      first_publish_year: 1965,
      open_library_work_key: "/works/OL893415W",
      edition_count: 481,
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
