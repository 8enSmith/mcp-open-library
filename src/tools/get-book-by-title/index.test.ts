import { describe, expect, it, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";
import { SEARCH_FIELDS, SearchResults } from "../../utils/search.js";

import { handleGetBookByTitle, GetBookByTitleArgsSchema } from "./index.js";

function parsePayload(
  result: Awaited<ReturnType<typeof handleGetBookByTitle>>,
): SearchResults {
  return JSON.parse(
    (result.content[0] as { type: "text"; text: string }).text,
  ) as SearchResults;
}

describe("handleGetBookByTitle", () => {
  let get: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    get = vi.fn();
    clients = {
      api: { get },
      covers: { head: vi.fn() },
    } as unknown as OpenLibraryClients;
  });

  it("should return book data when title is valid and books are found", async () => {
    get.mockResolvedValue({
      data: {
        numFound: 42,
        docs: [
          {
            title: "Test Book",
            author_name: ["Author One", "Author Two"],
            author_key: ["OL1A", "OL2A"],
            first_publish_year: 2020,
            key: "/works/test123",
            edition_count: 5,
            cover_i: 12345,
            ratings_average: 3.957627118644068,
            ebook_access: "borrowable",
            editions: {
              numFound: 3,
              docs: [
                {
                  key: "/books/OL7500941M",
                  isbn: ["9780425038918", "0425038912"],
                },
              ],
            },
          },
        ],
      },
    });

    const result = await handleGetBookByTitle({ title: "Test Book" }, clients);

    expect(get).toHaveBeenCalledWith("/search.json", {
      params: {
        title: "Test Book",
        fields: SEARCH_FIELDS,
        limit: 10,
        offset: 0,
      },
    });

    expect(parsePayload(result)).toEqual({
      num_found: 42,
      offset: 0,
      limit: 10,
      results: [
        {
          title: "Test Book",
          authors: ["Author One", "Author Two"],
          author_keys: ["OL1A", "OL2A"],
          first_publish_year: 2020,
          open_library_work_key: "/works/test123",
          edition_count: 5,
          best_edition: {
            edition_key: "OL7500941M",
            isbn_13: "9780425038918",
            isbn_10: "0425038912",
          },
          cover_url: "https://covers.openlibrary.org/b/id/12345-M.jpg",
          ratings_average: 3.96,
          ebook_access: "borrowable",
        },
      ],
    });
  });

  it("should pass through limit and offset", async () => {
    get.mockResolvedValue({
      data: { numFound: 500, docs: [{ title: "A", key: "/works/a" }] },
    });

    const result = await handleGetBookByTitle(
      { title: "dune", limit: 3, offset: 20 },
      clients,
    );

    expect(get).toHaveBeenCalledWith("/search.json", {
      params: { title: "dune", fields: SEARCH_FIELDS, limit: 3, offset: 20 },
    });

    const payload = parsePayload(result);
    expect(payload.limit).toBe(3);
    expect(payload.offset).toBe(20);
    expect(payload.num_found).toBe(500);
  });

  it("should reject a limit above the maximum", async () => {
    await expect(
      handleGetBookByTitle({ title: "dune", limit: 51 }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
    expect(get).not.toHaveBeenCalled();
  });

  it("should handle book with missing optional fields", async () => {
    get.mockResolvedValue({
      data: { docs: [{ title: "Minimal Book", key: "/works/minimal123" }] },
    });

    const result = await handleGetBookByTitle(
      { title: "Minimal Book" },
      clients,
    );

    expect(parsePayload(result).results[0]).toEqual({
      title: "Minimal Book",
      authors: [],
      first_publish_year: null,
      open_library_work_key: "/works/minimal123",
      edition_count: 0,
    });
  });

  it("should fall back to the returned document count when numFound is absent", async () => {
    get.mockResolvedValue({
      data: { docs: [{ title: "Only", key: "/works/only" }] },
    });

    const result = await handleGetBookByTitle({ title: "Only" }, clients);

    expect(parsePayload(result).num_found).toBe(1);
  });

  it("should return appropriate message when no books are found", async () => {
    get.mockResolvedValue({ data: { docs: [] } });

    const result = await handleGetBookByTitle(
      { title: "Nonexistent Book" },
      clients,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'No books found matching title: "Nonexistent Book"',
        },
      ],
    });
  });

  it("should reject for invalid arguments", async () => {
    await expect(handleGetBookByTitle({ title: "" }, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );

    await expect(
      handleGetBookByTitle({ wrongParam: "something" }, clients),
    ).rejects.toThrow(InvalidArgumentsError);

    await expect(handleGetBookByTitle(null, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );
  });

  it("should report the status code for API errors", async () => {
    const axiosError = new Error("Request failed");
    Object.defineProperty(axiosError, "isAxiosError", { value: true });
    Object.defineProperty(axiosError, "response", {
      value: { status: 503, statusText: "Service Unavailable" },
    });

    get.mockRejectedValue(axiosError);

    const result = await handleGetBookByTitle({ title: "Test Book" }, clients);

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Open Library API error: 503 Service Unavailable",
        },
      ],
      isError: true,
    });
  });

  it("should handle non-axios errors", async () => {
    get.mockRejectedValue(new Error("Unknown Error"));

    const result = await handleGetBookByTitle({ title: "Test Book" }, clients);

    expect(result).toEqual({
      content: [
        { type: "text", text: "Open Library API error: Unknown Error" },
      ],
      isError: true,
    });
  });

  describe("GetBookByTitleArgsSchema", () => {
    it("should validate correct input", () => {
      const result = GetBookByTitleArgsSchema.safeParse({
        title: "Valid Title",
      });
      expect(result.success).toBe(true);
    });

    it("should apply default limit and offset", () => {
      const result = GetBookByTitleArgsSchema.parse({ title: "Valid Title" });
      expect(result).toEqual({ title: "Valid Title", limit: 10, offset: 0 });
    });

    it("should reject empty title", () => {
      expect(GetBookByTitleArgsSchema.safeParse({ title: "" }).success).toBe(
        false,
      );
    });

    it("should reject missing title", () => {
      expect(GetBookByTitleArgsSchema.safeParse({}).success).toBe(false);
    });

    it("should reject a non-integer limit", () => {
      expect(
        GetBookByTitleArgsSchema.safeParse({ title: "x", limit: 2.5 }).success,
      ).toBe(false);
    });
  });
});
