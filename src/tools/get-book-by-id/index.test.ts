/* eslint-disable @typescript-eslint/no-explicit-any */
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, it, expect, beforeEach, vi, Mock } from "vitest"; // Use vitest imports

import { OpenLibraryBookResponse } from "./types.js"; // Import necessary type

import { handleGetBookById } from "./index.js";

// Mock axios using vitest
vi.mock("axios");

// Create a mock Axios instance type using vitest Mock
type MockAxiosInstance = {
  get: Mock; // Use Mock from vitest
};

describe("handleGetBookById", () => {
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    // Reset mocks before each test using vitest
    vi.clearAllMocks();
    // Create a fresh mock instance for each test using vitest
    mockAxiosInstance = {
      get: vi.fn(), // Use vi.fn()
    };
  });

  it("should return book details when given a valid OLID", async () => {
    const mockArgs = { idType: "olid", idValue: "OL7353617M" };
    const mockApiResponse: OpenLibraryBookResponse = {
      records: {
        "/books/OL7353617M": {
          recordURL:
            "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
          data: {
            title: "The Lord of the Rings",
            authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
            publish_date: "1954",
            identifiers: {
              openlibrary: ["OL7353617M"],
              isbn_10: ["061826027X"],
            },
            number_of_pages: 1216,
            cover: {
              medium: "https://covers.openlibrary.org/b/id/8264411-M.jpg",
            },
            key: "/books/OL7353617M",
            url: "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
          },
          details: {
            info_url:
              "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
            bib_key: "OLID:OL7353617M",
            preview_url: "https://archive.org/details/lordofrings00tolk_1",
            thumbnail_url: "https://covers.openlibrary.org/b/id/8264411-S.jpg",
            details: {
              key: "/books/OL7353617M",
              works: [{ key: "/works/OL45804W" }],
              title: "The Lord of the Rings",
              authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
              publishers: [{ name: "Houghton Mifflin" }],
              publish_date: "1954",
              isbn_10: ["061826027X"],
              number_of_pages: 1216,
            },
            preview: "restricted",
          },
        },
      },
      items: [], // Add required items property
    };

    mockAxiosInstance.get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any); // Cast to any for simplicity

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/olid/OL7353617M.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"title": "The Lord of the Rings"'),
        },
      ],
    });
    // Check specific fields in the parsed JSON
    const parsedResult = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsedResult).toHaveProperty("title", "The Lord of the Rings");
    expect(parsedResult).toHaveProperty("authors", ["J.R.R. Tolkien"]);
    expect(parsedResult).toHaveProperty("publish_date", "1954");
    expect(parsedResult).toHaveProperty("number_of_pages", 1216);
    expect(parsedResult).toHaveProperty("isbn_10", ["061826027X"]); // Should be array from details
    expect(parsedResult).toHaveProperty("olid", ["OL7353617M"]); // Should be array from identifiers
    expect(parsedResult).toHaveProperty(
      "open_library_edition_key",
      "/books/OL7353617M",
    );
    expect(parsedResult).toHaveProperty(
      "open_library_work_key",
      "/works/OL45804W",
    );
    expect(parsedResult).toHaveProperty(
      "cover_url",
      "https://covers.openlibrary.org/b/id/8264411-M.jpg",
    );
    expect(parsedResult).toHaveProperty(
      "info_url",
      "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
    );
    expect(parsedResult).toHaveProperty(
      "preview_url",
      "https://archive.org/details/lordofrings00tolk_1",
    );
  });

  it("should return book details when given a valid ISBN", async () => {
    const mockArgs = { idType: "isbn", idValue: "9780547928227" };
    const mockApiResponse: OpenLibraryBookResponse = {
      records: {
        "isbn:9780547928227": {
          recordURL: "https://openlibrary.org/books/OL25189068M/The_Hobbit",
          data: {
            title: "The Hobbit",
            authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
            publish_date: "2012",
            identifiers: {
              isbn_13: ["9780547928227"],
              openlibrary: ["OL25189068M"],
            },
            key: "/books/OL25189068M",
            url: "https://openlibrary.org/books/OL25189068M/The_Hobbit",
          },
          details: {
            /* ... potentially more details ... */
          } as any, // Cast for brevity
        },
      },
      items: [], // Add required items property
    };
    mockAxiosInstance.get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/isbn/9780547928227.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"title": "The Hobbit"'),
        },
      ],
    });
    const parsedResult = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsedResult).toHaveProperty("title", "The Hobbit");
    expect(parsedResult).toHaveProperty("isbn_13", ["9780547928227"]);
    expect(parsedResult).toHaveProperty("olid", ["OL25189068M"]);
  });

  it("should throw McpError for invalid arguments", async () => {
    const invalidArgs = { idType: "invalid", idValue: "123" }; // Invalid idType

    await expect(
      handleGetBookById(invalidArgs, mockAxiosInstance as any),
    ).rejects.toThrow(McpError);

    try {
      await handleGetBookById(invalidArgs, mockAxiosInstance as any);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
      expect((error as McpError).message).toContain(
        "Invalid arguments for get_book_by_id",
      );
      expect((error as McpError).message).toContain(
        "idType must be one of: isbn, lccn, oclc, olid",
      );
    }
    expect(mockAxiosInstance.get).not.toHaveBeenCalled();
  });

  it('should return "No book found" message when API returns empty records', async () => {
    const mockArgs = { idType: "olid", idValue: "OL_NONEXISTENT" };
    const mockApiResponse: OpenLibraryBookResponse = {
      records: {},
      items: [],
    }; // Empty records

    mockAxiosInstance.get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/olid/OL_NONEXISTENT.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "No book found for olid: OL_NONEXISTENT",
        },
      ],
    });
  });

  it('should return "No book found" message on 404 API error', async () => {
    const mockArgs = { idType: "isbn", idValue: "0000000000" };
    const axiosError = {
      isAxiosError: true,
      response: { status: 404, statusText: "Not Found" },
      message: "Request failed with status code 404",
    };
    mockAxiosInstance.get.mockRejectedValue(axiosError);

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/isbn/0000000000.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Failed to fetch book data from Open Library.", // Specific message for 404
        },
      ],
    });
  });

  it("should return generic API error message for non-404 errors", async () => {
    const mockArgs = { idType: "olid", idValue: "OL1M" };
    const axiosError = {
      isAxiosError: true,
      response: { status: 500, statusText: "Internal Server Error" },
      message: "Request failed with status code 500",
    };
    mockAxiosInstance.get.mockRejectedValue(axiosError);

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/olid/OL1M.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Failed to fetch book data from Open Library.", // Generic API error
        },
      ],
    });
  });

  it("should return generic error message for non-Axios errors", async () => {
    const mockArgs = { idType: "olid", idValue: "OL1M" };
    const genericError = new Error("Network Failure");
    mockAxiosInstance.get.mockRejectedValue(genericError);

    const result = await handleGetBookById(mockArgs, mockAxiosInstance as any);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/volumes/brief/olid/OL1M.json",
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error processing request: Network Failure", // Generic processing error
        },
      ],
    });
  });
});
