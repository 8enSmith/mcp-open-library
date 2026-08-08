/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Mock } from "vitest";

import { OpenLibraryServer } from "./index.js";
// Mock the MCP Server and its methods
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  const mockServer = {
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onerror: vi.fn(),
  };
  return {
    Server: vi.fn(() => mockServer),
  };
});

// Mock axios
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true); // Use true for deep mocking

describe("OpenLibraryServer", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let serverInstance: OpenLibraryServer;
  // Explicitly type the mock server instance based on the mocked structure
  let mockMcpServer: {
    setRequestHandler: Mock<
      (schema: any, handler: (...args: any[]) => Promise<any>) => void
    >;
    connect: Mock<(transport: any) => Promise<void>>;
    close: Mock<() => Promise<void>>;
    onerror: Mock<(error: any) => void>;
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Create a new instance, which will internally create a mocked Server
    serverInstance = new OpenLibraryServer();
    // Get the mocked MCP Server instance created by the constructor
    mockMcpServer = (Server as any).mock.results[0].value;
    mockedAxios.create.mockReturnThis(); // Ensure axios.create() returns the mocked instance
  });

  it("reports the version from package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    const [implementation] = (Server as any).mock.calls[0];

    expect(implementation.version).toBe(pkg.version);
    expect(implementation.name).toBe("open-library-server");
  });

  describe("get_book_by_title tool", () => {
    it("should correctly list the get_book_by_title tool", async () => {
      // Find the handler registered for ListToolsRequestSchema
      const listToolsHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === ListToolsRequestSchema,
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      if (listToolsHandler) {
        const result = await listToolsHandler({} as any); // Call the handler
        expect(result.tools).toHaveLength(6);
        expect(result.tools[0].name).toBe("get_book_by_title");
        expect(result.tools[0].description).toBeDefined();
        expect(result.tools[0].inputSchema).toEqual({
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the book to search for.",
            },
          },
          required: ["title"],
        });
      }
    });
  });

  describe("get_authors_by_name tool", () => {
    it("should correctly list the get_authors_by_name tool", async () => {
      const listToolsHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === ListToolsRequestSchema,
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      if (listToolsHandler) {
        const result = await listToolsHandler({} as any);
        expect(result.tools).toHaveLength(6);
        const authorTool = result.tools.find(
          (tool: any) => tool.name === "get_authors_by_name",
        );
        expect(authorTool).toBeDefined();
        expect(authorTool.description).toBeDefined();
        expect(authorTool.inputSchema).toEqual({
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the author to search for.",
            },
          },
          required: ["name"],
        });
      }
    });

    it("should handle CallTool request for get_authors_by_name successfully", async () => {
      const callToolHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === CallToolRequestSchema,
      )?.[1];

      expect(callToolHandler).toBeDefined();

      if (callToolHandler) {
        const mockApiResponse = {
          data: {
            docs: [
              {
                key: "OL23919A",
                name: "J. R. R. Tolkien",
                alternate_names: ["John Ronald Reuel Tolkien"],
                birth_date: "3 January 1892",
                top_work: "The Lord of the Rings",
                work_count: 150,
              },
            ],
          },
        };
        mockedAxios.get.mockResolvedValue(mockApiResponse);

        const mockRequest = {
          params: {
            name: "get_authors_by_name",
            arguments: { name: "J. R. R. Tolkien" },
          },
        };

        const result = await callToolHandler(mockRequest as any);

        expect(mockedAxios.get).toHaveBeenCalledWith("/search/authors.json", {
          params: { q: "J. R. R. Tolkien" },
        });
        expect(result.isError).toBeUndefined();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        const expectedAuthorInfo = [
          {
            key: "OL23919A",
            name: "J. R. R. Tolkien",
            alternate_names: ["John Ronald Reuel Tolkien"],
            birth_date: "3 January 1892",
            top_work: "The Lord of the Rings",
            work_count: 150,
          },
        ];
        expect(JSON.parse(result.content[0].text)).toEqual(expectedAuthorInfo);
      }
    });
  });

  describe("get_author_info tool", () => {
    it("should correctly list the get_author_info tool", async () => {
      const listToolsHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === ListToolsRequestSchema,
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      if (listToolsHandler) {
        const result = await listToolsHandler({} as any);
        expect(result.tools).toHaveLength(6);
        const authorInfoTool = result.tools.find(
          (tool: any) => tool.name === "get_author_info",
        );
        expect(authorInfoTool).toBeDefined();
        expect(authorInfoTool.description).toBeDefined();
        expect(authorInfoTool.inputSchema).toEqual({
          type: "object",
          properties: {
            author_key: {
              type: "string",
              description:
                "The Open Library key for the author (e.g., OL23919A).",
            },
          },
          required: ["author_key"],
        });
      }
    });

    it("should handle CallTool request for get_author_info successfully", async () => {
      const callToolHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === CallToolRequestSchema,
      )?.[1];

      expect(callToolHandler).toBeDefined();

      if (callToolHandler) {
        const mockApiResponse = {
          data: {
            key: "/authors/OL23919A",
            name: "J. R. R. Tolkien",
            birth_date: "3 January 1892",
            death_date: "2 September 1973",
            bio: "British writer, poet, philologist, and university professor",
            photos: [12345],
          },
        };
        mockedAxios.get.mockResolvedValue(mockApiResponse);

        const mockRequest = {
          params: {
            name: "get_author_info",
            arguments: { author_key: "OL23919A" },
          },
        };

        const result = await callToolHandler(mockRequest as any);

        expect(mockedAxios.get).toHaveBeenCalledWith("/authors/OL23919A.json");
        expect(result.isError).toBeUndefined();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        expect(JSON.parse(result.content[0].text)).toEqual(
          mockApiResponse.data,
        );
      }
    });
  });

  describe("get_author_photo tool", () => {
    it("should correctly list the get_author_photo tool", async () => {
      const listToolsHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === ListToolsRequestSchema,
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      if (listToolsHandler) {
        const result = await listToolsHandler({} as any);
        expect(result.tools).toHaveLength(6);
        const authorPhotoTool = result.tools.find(
          (tool: any) => tool.name === "get_author_photo",
        );
        expect(authorPhotoTool).toBeDefined();
        expect(authorPhotoTool.description).toBeDefined();
        expect(authorPhotoTool.inputSchema).toEqual({
          type: "object",
          properties: {
            olid: {
              type: "string",
              description:
                "The Open Library Author ID (OLID) for the author (e.g. OL23919A).",
            },
          },
          required: ["olid"],
        });
      }
    });

    it("should handle CallTool request for get_author_photo successfully", async () => {
      const callToolHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === CallToolRequestSchema,
      )?.[1];

      expect(callToolHandler).toBeDefined();

      if (callToolHandler) {
        const mockRequest = {
          params: {
            name: "get_author_photo",
            arguments: { olid: "OL23919A" },
          },
        };

        const result = await callToolHandler(mockRequest as any);

        expect(mockedAxios.get).not.toHaveBeenCalled(); // No API call expected
        expect(result.isError).toBeUndefined();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toBe(
          "https://covers.openlibrary.org/a/olid/OL23919A-L.jpg",
        );
      }
    });
  });

  describe("get_book_cover tool", () => {
    it("should correctly list the get_book_cover tool", async () => {
      const listToolsHandler = mockMcpServer.setRequestHandler.mock.calls.find(
        (call: [any, (...args: any[]) => Promise<any>]) =>
          call[0] === ListToolsRequestSchema,
      )?.[1];

      expect(listToolsHandler).toBeDefined();

      if (listToolsHandler) {
        const result = await listToolsHandler({} as any);
        expect(result.tools.length).toBeGreaterThanOrEqual(5);
        const bookCoverTool = result.tools.find(
          (tool: any) => tool.name === "get_book_cover",
        );
        expect(bookCoverTool).toBeDefined();
        expect(bookCoverTool.description).toBeDefined();
        expect(bookCoverTool.inputSchema).toEqual({
          type: "object",
          properties: {
            key: {
              type: "string",
              enum: ["ISBN", "OCLC", "LCCN", "OLID", "ID"],
              description:
                "The type of identifier used (ISBN, OCLC, LCCN, OLID, ID).",
            },
            value: {
              type: "string",
              description: "The value of the identifier.",
            },
            size: {
              type: "string",
              enum: ["S", "M", "L"],
              description: "The desired size of the cover (S, M, or L).",
            },
          },
          required: ["key", "value"],
        });
      }
    });
  });

  it("should handle CallTool request for an unknown tool", async () => {
    const callToolHandler = mockMcpServer.setRequestHandler.mock.calls.find(
      (call: [any, (...args: any[]) => Promise<any>]) =>
        call[0] === CallToolRequestSchema,
    )?.[1];

    expect(callToolHandler).toBeDefined();

    if (callToolHandler) {
      const mockRequest = {
        params: {
          name: "unknown_tool",
          arguments: { title: "The Hobbit" }, // Args don't matter here
        },
      };

      await expect(callToolHandler(mockRequest as any)).rejects.toThrow(
        new McpError(ErrorCode.MethodNotFound, "Unknown tool: unknown_tool"),
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    }
  });
});
