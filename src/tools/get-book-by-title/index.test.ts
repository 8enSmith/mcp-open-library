import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { handleGetBookByTitle, GetBookByTitleArgsSchema } from "./index.js";

// Mock axios
vi.mock("axios");

describe("handleGetBookByTitle", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
    };
  });

  it("should return book data when title is valid and books are found", async () => {
    // Mock response data
    const mockResponseData = {
      docs: [
        {
          title: "Test Book",
          author_name: ["Author One", "Author Two"],
          first_publish_year: 2020,
          key: "/works/test123",
          edition_count: 5,
          cover_i: 12345,
        },
      ],
    };

    mockAxiosInstance.get.mockResolvedValue({ data: mockResponseData });

    const result = await handleGetBookByTitle(
      { title: "Test Book" },
      mockAxiosInstance,
    );

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/search.json", {
      params: { title: "Test Book" },
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            [
              {
                title: "Test Book",
                authors: ["Author One", "Author Two"],
                first_publish_year: 2020,
                open_library_work_key: "/works/test123",
                edition_count: 5,
                cover_url: "https://covers.openlibrary.org/b/id/12345-M.jpg",
              },
            ],
            null,
            2,
          ),
        },
      ],
    });
  });

  it("should handle book with missing optional fields", async () => {
    // Mock response with missing optional fields
    const mockResponseData = {
      docs: [
        {
          title: "Minimal Book",
          key: "/works/minimal123",
        },
      ],
    };

    mockAxiosInstance.get.mockResolvedValue({ data: mockResponseData });

    const result = await handleGetBookByTitle(
      { title: "Minimal Book" },
      mockAxiosInstance,
    );

    expect(
      (result.content[0] as { type: "text"; text: string }).text,
    ).toContain("Minimal Book");
    expect(
      (
        JSON.parse(
          (result.content[0] as { type: "text"; text: string }).text,
        ) as Array<{
          title: string;
          authors: string[];
          first_publish_year: number | null;
          open_library_work_key: string;
          edition_count: number;
          cover_url?: string;
        }>
      )[0],
    ).toEqual({
      title: "Minimal Book",
      authors: [],
      first_publish_year: null,
      open_library_work_key: "/works/minimal123",
      edition_count: 0,
    });
  });

  it("should return appropriate message when no books are found", async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { docs: [] } });

    const result = await handleGetBookByTitle(
      { title: "Nonexistent Book" },
      mockAxiosInstance,
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

  it("should throw McpError for invalid arguments", async () => {
    await expect(async () => {
      await handleGetBookByTitle({ title: "" }, mockAxiosInstance);
    }).rejects.toThrow(McpError);

    await expect(async () => {
      await handleGetBookByTitle(
        { wrongParam: "something" },
        mockAxiosInstance,
      );
    }).rejects.toThrow(McpError);

    await expect(async () => {
      await handleGetBookByTitle(null, mockAxiosInstance);
    }).rejects.toThrow(McpError);
  });

  it("should handle API errors properly", async () => {
    const axiosError = new Error("Network Error");
    Object.defineProperty(axiosError, "isAxiosError", { value: true });
    Object.defineProperty(axiosError, "response", {
      value: { statusText: "Service Unavailable" },
    });

    mockAxiosInstance.get.mockRejectedValue(axiosError);

    const result = await handleGetBookByTitle(
      { title: "Test Book" },
      mockAxiosInstance,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error processing request: Network Error",
        },
      ],
      isError: true,
    });
  });

  it("should handle non-axios errors", async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error("Unknown Error"));

    const result = await handleGetBookByTitle(
      { title: "Test Book" },
      mockAxiosInstance,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error processing request: Unknown Error",
        },
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

    it("should reject empty title", () => {
      const result = GetBookByTitleArgsSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing title", () => {
      const result = GetBookByTitleArgsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
