import { describe, expect, it, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";
import { SEARCH_FIELDS, SearchResults } from "../../utils/search.js";

import { handleSearchBooks, SearchBooksArgsSchema } from "./index.js";

function parsePayload(
  result: Awaited<ReturnType<typeof handleSearchBooks>>,
): SearchResults {
  return JSON.parse(
    (result.content[0] as { type: "text"; text: string }).text,
  ) as SearchResults;
}

describe("handleSearchBooks", () => {
  let get: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    get = vi.fn();
    clients = {
      api: { get },
      covers: { head: vi.fn() },
    } as unknown as OpenLibraryClients;
  });

  it("should search with a free-form query and default paging", async () => {
    get.mockResolvedValue({
      data: {
        numFound: 20970,
        docs: [
          {
            title: "Dune",
            author_name: ["Frank Herbert"],
            key: "/works/OL893415W",
            edition_count: 100,
          },
        ],
      },
    });

    const result = await handleSearchBooks({ q: "dune" }, clients);

    expect(get).toHaveBeenCalledWith("/search.json", {
      params: { fields: SEARCH_FIELDS, limit: 10, offset: 0, q: "dune" },
    });

    expect(parsePayload(result)).toEqual({
      num_found: 20970,
      offset: 0,
      limit: 10,
      results: [
        {
          title: "Dune",
          authors: ["Frank Herbert"],
          first_publish_year: null,
          open_library_work_key: "/works/OL893415W",
          edition_count: 100,
        },
      ],
    });
  });

  it("should forward every supplied criterion, language and sort", async () => {
    get.mockResolvedValue({
      data: { numFound: 1, docs: [{ title: "x", key: "/works/x" }] },
    });

    await handleSearchBooks(
      {
        title: "earthsea",
        author: "le guin",
        subject: "fantasy",
        place: "gont",
        person: "ged",
        publisher: "puffin",
        isbn: "9780140306767",
        language: "eng",
        sort: "old",
        limit: 5,
        offset: 10,
      },
      clients,
    );

    expect(get).toHaveBeenCalledWith("/search.json", {
      params: {
        fields: SEARCH_FIELDS,
        limit: 5,
        offset: 10,
        title: "earthsea",
        author: "le guin",
        subject: "fantasy",
        place: "gont",
        person: "ged",
        publisher: "puffin",
        isbn: "9780140306767",
        language: "eng",
        sort: "old",
      },
    });
  });

  it("should omit criteria that were not supplied", async () => {
    get.mockResolvedValue({
      data: { numFound: 1, docs: [{ title: "x", key: "/works/x" }] },
    });

    await handleSearchBooks({ author: "le guin" }, clients);

    expect(get).toHaveBeenCalledWith("/search.json", {
      params: {
        fields: SEARCH_FIELDS,
        limit: 10,
        offset: 0,
        author: "le guin",
      },
    });
  });

  it("should reject a request with no search criteria", async () => {
    await expect(handleSearchBooks({ limit: 5 }, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it("should name the accepted criteria when none are supplied", async () => {
    await expect(handleSearchBooks({}, clients)).rejects.toThrow(
      /Provide at least one search criterion: q, title, author, subject, place, person, publisher, isbn/,
    );
  });

  it("should reject an unsupported sort value", async () => {
    await expect(
      handleSearchBooks({ q: "dune", sort: "notasort" }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
    expect(get).not.toHaveBeenCalled();
  });

  it("should reject a limit above the maximum", async () => {
    await expect(
      handleSearchBooks({ q: "dune", limit: 51 }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
    expect(get).not.toHaveBeenCalled();
  });

  it("should reject an offset above the maximum", async () => {
    await expect(
      handleSearchBooks({ q: "dune", offset: 1001 }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
  });

  it("should report the criteria used when nothing matches", async () => {
    get.mockResolvedValue({ data: { docs: [] } });

    const result = await handleSearchBooks(
      { title: "nope", author: "nobody" },
      clients,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'No books found matching: title="nope", author="nobody"',
        },
      ],
    });
  });

  it("should return an error result for API failures", async () => {
    const axiosError = new Error("Request failed");
    Object.defineProperty(axiosError, "isAxiosError", { value: true });
    Object.defineProperty(axiosError, "response", {
      value: { status: 500, statusText: "Internal Server Error" },
    });

    get.mockRejectedValue(axiosError);

    const result = await handleSearchBooks({ q: "dune" }, clients);

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Open Library API error: 500 Internal Server Error",
        },
      ],
      isError: true,
    });
  });

  describe("SearchBooksArgsSchema", () => {
    it("should accept a single criterion", () => {
      expect(SearchBooksArgsSchema.safeParse({ isbn: "123" }).success).toBe(
        true,
      );
    });

    it("should reject an empty criterion string", () => {
      expect(SearchBooksArgsSchema.safeParse({ q: "" }).success).toBe(false);
    });

    it("should reject a language code that is not three letters", () => {
      expect(
        SearchBooksArgsSchema.safeParse({ q: "dune", language: "en" }).success,
      ).toBe(false);
    });
  });
});
