import { AxiosError, AxiosHeaders } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import { OpenLibraryAuthorSearchResponse } from "./types.js";

import { handleGetAuthorsByName } from "./index.js";

const createMockConfig = () => ({
  headers: new AxiosHeaders(),
  url: "",
  method: "get",
});

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
      params: { q: "Tolkien" },
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          [
            {
              key: "OL23 Tolkien",
              name: "J.R.R. Tolkien",
              alternate_names: ["John Ronald Reuel Tolkien"],
              birth_date: "1892-01-03",
              top_work: "The Lord of the Rings",
              work_count: 100,
            },
          ],
          null,
          2,
        ),
      },
    ]);
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
});
