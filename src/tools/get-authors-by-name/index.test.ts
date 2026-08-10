import { AxiosError, AxiosHeaders } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import {
  AuthorSearchResults,
  OpenLibraryAuthorSearchResponse,
} from "./types.js";

import { handleGetAuthorsByName, GetAuthorsByNameArgsSchema } from "./index.js";

const createMockConfig = () => ({
  headers: new AxiosHeaders(),
  url: "",
  method: "get",
});

function parsePayload(
  result: Awaited<ReturnType<typeof handleGetAuthorsByName>>,
): AuthorSearchResults {
  return JSON.parse(
    (result.content[0] as { type: "text"; text: string }).text,
  ) as AuthorSearchResults;
}

describe("handleGetAuthorsByName", () => {
  let get: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    get = vi.fn();
    clients = {
      api: { get },
      covers: { head: vi.fn() },
    } as unknown as OpenLibraryClients;
  });

  it("should return author information when authors are found", async () => {
    const mockApiResponse: OpenLibraryAuthorSearchResponse = {
      numFound: 1,
      start: 0,
      numFoundExact: true,
      docs: [
        {
          key: "OL23 Tolkien",
          type: "author",
          name: "J.R.R. Tolkien",
          alternate_names: ["John Ronald Reuel Tolkien"],
          birth_date: "1892-01-03",
          top_work: "The Lord of the Rings",
          work_count: 100,
          top_subjects: ["fantasy", "fiction"],
          _version_: 12345,
        },
      ],
    };

    get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetAuthorsByName({ name: "Tolkien" }, clients);

    expect(get).toHaveBeenCalledWith("/search/authors.json", {
      params: { q: "Tolkien", limit: 10, offset: 0 },
    });
    expect(result.isError).toBeUndefined();
    expect(parsePayload(result)).toEqual({
      num_found: 1,
      offset: 0,
      limit: 10,
      results: [
        {
          key: "OL23 Tolkien",
          name: "J.R.R. Tolkien",
          alternate_names: ["John Ronald Reuel Tolkien"],
          birth_date: "1892-01-03",
          top_work: "The Lord of the Rings",
          work_count: 100,
        },
      ],
    });
  });

  // A name like "smith" matches ~45,000 authors and the API defaults to 100 per
  // page, so the bound is what keeps the payload out of the model's context.
  it("should pass through limit and offset", async () => {
    get.mockResolvedValue({
      data: {
        numFound: 44979,
        start: 10,
        numFoundExact: true,
        docs: [{ key: "OL1A", type: "author", name: "A Smith", work_count: 3 }],
      },
    });

    const result = await handleGetAuthorsByName(
      { name: "smith", limit: 3, offset: 10 },
      clients,
    );

    expect(get).toHaveBeenCalledWith("/search/authors.json", {
      params: { q: "smith", limit: 3, offset: 10 },
    });

    const payload = parsePayload(result);
    expect(payload.limit).toBe(3);
    expect(payload.offset).toBe(10);
    expect(payload.num_found).toBe(44979);
  });

  it("should reject a limit above the maximum", async () => {
    await expect(
      handleGetAuthorsByName({ name: "smith", limit: 51 }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
    expect(get).not.toHaveBeenCalled();
  });

  it("should fall back to the returned document count when numFound is absent", async () => {
    get.mockResolvedValue({
      data: {
        docs: [{ key: "OL1A", type: "author", name: "X", work_count: 1 }],
      },
    });

    const result = await handleGetAuthorsByName({ name: "X" }, clients);

    expect(parsePayload(result).num_found).toBe(1);
  });

  it("should return a message when no authors are found", async () => {
    get.mockResolvedValue({
      data: { numFound: 0, start: 0, numFoundExact: true, docs: [] },
    });

    const result = await handleGetAuthorsByName(
      { name: "NonExistentAuthor" },
      clients,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: 'No authors found matching name: "NonExistentAuthor"',
      },
    ]);
  });

  it("should report the status for Axios errors with a response", async () => {
    const mockConfig = createMockConfig();
    get.mockRejectedValue(
      new AxiosError(
        "Request failed with status code 500",
        "ERR_BAD_RESPONSE",
        mockConfig,
        null,
        {
          data: null,
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config: mockConfig,
        },
      ),
    );

    const result = await handleGetAuthorsByName({ name: "ErrorCase" }, clients);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Open Library API error: 500 Internal Server Error",
      },
    ]);
  });

  it("should fall back to the message for Axios errors without a response", async () => {
    get.mockRejectedValue(
      new AxiosError(
        "Network Error",
        "ECONNREFUSED",
        createMockConfig(),
        null,
        undefined,
      ),
    );

    const result = await handleGetAuthorsByName(
      { name: "NetworkErrorCase" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Open Library API error: Network Error" },
    ]);
  });

  it("should handle generic errors", async () => {
    get.mockRejectedValue(new Error("Something went wrong"));

    const result = await handleGetAuthorsByName(
      { name: "GenericError" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Open Library API error: Something went wrong" },
    ]);
  });

  it("should reject for invalid arguments (empty name)", async () => {
    await expect(handleGetAuthorsByName({ name: "" }, clients)).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_authors_by_name: name: Author name cannot be empty",
      ),
    );

    expect(get).not.toHaveBeenCalled();
  });

  it("should reject for invalid arguments (missing name)", async () => {
    await expect(handleGetAuthorsByName({}, clients)).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_authors_by_name: name: Invalid input: expected string, received undefined",
      ),
    );

    expect(get).not.toHaveBeenCalled();
  });

  describe("GetAuthorsByNameArgsSchema", () => {
    it("should apply default limit and offset", () => {
      expect(GetAuthorsByNameArgsSchema.parse({ name: "Tolkien" })).toEqual({
        name: "Tolkien",
        limit: 10,
        offset: 0,
      });
    });

    it("should reject a non-integer limit", () => {
      expect(
        GetAuthorsByNameArgsSchema.safeParse({ name: "x", limit: 2.5 }).success,
      ).toBe(false);
    });

    it("should reject an offset above the maximum", () => {
      expect(
        GetAuthorsByNameArgsSchema.safeParse({ name: "x", offset: 1001 })
          .success,
      ).toBe(false);
    });
  });
});
