import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { AxiosInstance, AxiosError, AxiosHeaders } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OpenLibraryAuthorSearchResponse } from "./types.js";

import { handleGetAuthorsByName } from "./index.js";

// Mock axios module
vi.mock("axios");

// Create a mock Axios instance
const mockAxiosInstance = {
  get: vi.fn(),
} as unknown as AxiosInstance;

const mockedAxiosInstanceGet = vi.mocked(mockAxiosInstance.get);

// Helper to create a minimal valid config
const createMockConfig = () => ({
  headers: new AxiosHeaders(), // Use AxiosHeaders
  url: "",
  method: "get",
  // Add other minimal required properties if necessary based on Axios types
});

describe("handleGetAuthorsByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return author information when authors are found", async () => {
    const mockArgs = { name: "Tolkien" };
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

    const mockConfig = createMockConfig();
    const mockAxiosResponse = {
      data: mockApiResponse,
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      config: mockConfig,
    };

    mockedAxiosInstanceGet.mockResolvedValue(mockAxiosResponse);

    const result = await handleGetAuthorsByName(mockArgs, mockAxiosInstance);

    expect(mockedAxiosInstanceGet).toHaveBeenCalledWith(
      "/search/authors.json",
      { params: { q: "Tolkien" } },
    );
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
    const mockArgs = { name: "NonExistentAuthor" };
    const mockApiResponse: OpenLibraryAuthorSearchResponse = {
      numFound: 0,
      start: 0,
      numFoundExact: true,
      docs: [],
    };

    const mockConfig = createMockConfig();
    const mockAxiosResponse = {
      data: mockApiResponse,
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      config: mockConfig,
    };

    mockedAxiosInstanceGet.mockResolvedValue(mockAxiosResponse);

    const result = await handleGetAuthorsByName(mockArgs, mockAxiosInstance);

    expect(mockedAxiosInstanceGet).toHaveBeenCalledWith(
      "/search/authors.json",
      { params: { q: "NonExistentAuthor" } },
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: 'No authors found matching name: "NonExistentAuthor"',
      },
    ]);
  });

  it("should handle Axios errors with response", async () => {
    const mockArgs = { name: "ErrorCase" };
    const mockConfig = createMockConfig();
    const mockResponse = {
      data: null,
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config: mockConfig,
    };

    const axiosError = new AxiosError(
      "Request failed with status code 500",
      "ERR_BAD_RESPONSE",
      mockConfig,
      null,
      mockResponse,
    );

    mockedAxiosInstanceGet.mockRejectedValue(axiosError);

    const result = await handleGetAuthorsByName(mockArgs, mockAxiosInstance);

    expect(mockedAxiosInstanceGet).toHaveBeenCalledWith(
      "/search/authors.json",
      { params: { q: "ErrorCase" } },
    );
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Failed to fetch author data from Open Library.",
      },
    ]);
  });

  it("should handle Axios errors without response (e.g., network error)", async () => {
    const mockArgs = { name: "NetworkErrorCase" };
    const mockConfig = createMockConfig();

    const axiosError = new AxiosError(
      "Network Error", // Message
      "ECONNREFUSED", // Code
      mockConfig, // Config
      null, // Request
      undefined,
    );

    mockedAxiosInstanceGet.mockRejectedValue(axiosError);

    const result = await handleGetAuthorsByName(mockArgs, mockAxiosInstance);

    expect(mockedAxiosInstanceGet).toHaveBeenCalledWith(
      "/search/authors.json",
      { params: { q: "NetworkErrorCase" } },
    );
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Failed to fetch author data from Open Library.",
      },
    ]);
  });

  it("should handle generic errors", async () => {
    const mockArgs = { name: "GenericError" };
    const genericError = new Error("Something went wrong");

    mockedAxiosInstanceGet.mockRejectedValue(genericError);

    const result = await handleGetAuthorsByName(mockArgs, mockAxiosInstance);

    expect(mockedAxiosInstanceGet).toHaveBeenCalledWith(
      "/search/authors.json",
      { params: { q: "GenericError" } },
    );
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Error processing request: Something went wrong",
      },
    ]);
  });

  it("should throw McpError for invalid arguments (empty name)", async () => {
    const mockArgs = { name: "" };

    await expect(
      handleGetAuthorsByName(mockArgs, mockAxiosInstance),
    ).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_authors_by_name: name: Author name cannot be empty",
      ),
    );

    expect(mockedAxiosInstanceGet).not.toHaveBeenCalled();
  });

  it("should throw McpError for invalid arguments (missing name)", async () => {
    const mockArgs = {};

    await expect(
      handleGetAuthorsByName(mockArgs, mockAxiosInstance),
    ).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_authors_by_name: name: Invalid input: expected string, received undefined",
      ),
    );

    expect(mockedAxiosInstanceGet).not.toHaveBeenCalled();
  });
});
