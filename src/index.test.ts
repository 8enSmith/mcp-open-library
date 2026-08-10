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

import { TOOLS } from "./tools/registry.js";
import { SEARCH_FIELDS } from "./utils/search.js";

import { OpenLibraryServer } from "./index.js";

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

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("OpenLibraryServer", () => {
  let mockMcpServer: {
    setRequestHandler: Mock<
      (schema: any, handler: (...args: any[]) => Promise<any>) => void
    >;
    connect: Mock<(transport: any) => Promise<void>>;
    close: Mock<() => Promise<void>>;
    onerror: Mock<(error: any) => void>;
  };

  function getHandler(schema: unknown) {
    const handler = mockMcpServer.setRequestHandler.mock.calls.find(
      (call: [any, (...args: any[]) => Promise<any>]) => call[0] === schema,
    )?.[1];
    expect(handler).toBeDefined();
    return handler as (request: any) => Promise<any>;
  }

  const listTools = () => getHandler(ListToolsRequestSchema)({});
  const callTool = (name: string, args: unknown) =>
    getHandler(CallToolRequestSchema)({ params: { name, arguments: args } });

  beforeEach(() => {
    vi.clearAllMocks();
    // Both clients are created in the constructor, so the return value has to
    // be in place before the server is built.
    mockedAxios.create.mockReturnThis();
    new OpenLibraryServer();
    mockMcpServer = (Server as any).mock.results[0].value;
  });

  it("reports the version from package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    const [implementation] = (Server as any).mock.calls[0];

    expect(implementation.version).toBe(pkg.version);
    expect(implementation.name).toBe("open-library-server");
  });

  describe("ListTools", () => {
    it("lists every tool in the registry", async () => {
      const result = await listTools();

      expect(result.tools).toHaveLength(TOOLS.length);
      expect(result.tools.map((tool: any) => tool.name)).toEqual(
        TOOLS.map((tool) => tool.name),
      );
    });

    it("gives every tool a unique name, a title, a description and an object schema", async () => {
      const result = await listTools();
      const names = result.tools.map((tool: any) => tool.name);

      expect(new Set(names).size).toBe(names.length);
      for (const tool of result.tools) {
        expect(tool.title, `${tool.name} title`).toBeTruthy();
        expect(tool.description, `${tool.name} description`).toBeTruthy();
        expect(tool.inputSchema.type, `${tool.name} schema`).toBe("object");
      }
    });

    // Every tool is a read-only lookup, which lets clients skip the
    // confirmation prompt they show for tools that might change something.
    it("marks every tool read-only and open-world", async () => {
      const result = await listTools();

      for (const tool of result.tools) {
        expect(tool.annotations, `${tool.name} annotations`).toEqual({
          readOnlyHint: true,
          openWorldHint: true,
        });
      }
    });

    // Generated from each tool's zod schema, so this snapshot is the review
    // surface for any change to what clients are told a tool accepts.
    it("matches the published tool schemas", async () => {
      const result = await listTools();
      expect(result.tools).toMatchSnapshot();
    });
  });

  describe("CallTool", () => {
    it("routes search_books to the Open Library search endpoint", async () => {
      mockedAxios.get.mockResolvedValue({
        data: { numFound: 1, docs: [{ title: "Dune", key: "/works/OL1W" }] },
      });

      const result = await callTool("search_books", { q: "dune", limit: 1 });

      expect(mockedAxios.get).toHaveBeenCalledWith("/search.json", {
        params: { fields: SEARCH_FIELDS, limit: 1, offset: 0, q: "dune" },
      });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text).num_found).toBe(1);
    });

    it("handles get_authors_by_name", async () => {
      const docs = [
        {
          key: "OL23919A",
          name: "J. R. R. Tolkien",
          alternate_names: ["John Ronald Reuel Tolkien"],
          birth_date: "3 January 1892",
          top_work: "The Lord of the Rings",
          work_count: 150,
        },
      ];
      mockedAxios.get.mockResolvedValue({ data: { docs } });

      const result = await callTool("get_authors_by_name", {
        name: "J. R. R. Tolkien",
      });

      expect(mockedAxios.get).toHaveBeenCalledWith("/search/authors.json", {
        params: { q: "J. R. R. Tolkien" },
      });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(docs);
    });

    it("handles get_author_info", async () => {
      const data = {
        key: "/authors/OL23919A",
        name: "J. R. R. Tolkien",
        birth_date: "3 January 1892",
        death_date: "2 September 1973",
        bio: "British writer, poet, philologist, and university professor",
        photos: [12345],
      };
      mockedAxios.get.mockResolvedValue({ data });

      const result = await callTool("get_author_info", {
        author_key: "OL23919A",
      });

      expect(mockedAxios.get).toHaveBeenCalledWith("/authors/OL23919A.json");
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });

    it("handles get_author_photo against the covers host", async () => {
      mockedAxios.head.mockResolvedValue({ status: 200 });

      const result = await callTool("get_author_photo", { olid: "OL23919A" });

      expect(mockedAxios.head).toHaveBeenCalledWith("/a/olid/OL23919A-L.jpg", {
        params: { default: false },
        validateStatus: expect.any(Function),
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe(
        "https://covers.openlibrary.org/a/olid/OL23919A-L.jpg",
      );
    });

    // Failing to find a tool is one of the cases the spec keeps at the
    // protocol level, so this stays a thrown McpError.
    it("rejects an unknown tool as a protocol error", async () => {
      await expect(
        callTool("unknown_tool", { title: "The Hobbit" }),
      ).rejects.toThrow(
        new McpError(ErrorCode.MethodNotFound, "Unknown tool: unknown_tool"),
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    // Everything the tool itself raises comes back as a tool error instead, so
    // the model can read what was wrong and fix its next call.
    it("returns rejected arguments as a tool error, not a protocol error", async () => {
      const result = await callTool("search_books", { q: "dune", limit: 51 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "Invalid arguments for search_books: limit: Too big: expected number to be <=50",
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("returns a missing search criterion as a tool error naming the options", async () => {
      const result = await callTool("search_books", { limit: 5 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Provide at least one search criterion: q, title, author, subject, place, person, publisher, isbn",
      );
    });

    it("converts an unexpected handler throw into a tool error", async () => {
      mockedAxios.get.mockImplementation(() => {
        throw new TypeError("boom");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await callTool("get_author_info", {
        author_key: "OL23919A",
      });

      // get_author_info catches its own request failures, so this lands on the
      // generic Open Library message rather than the boundary's.
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Open Library API error: boom");
    });
  });
});
