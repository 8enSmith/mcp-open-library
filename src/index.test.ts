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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Mock } from "vitest";

import { TOOLS, TOOLS_BY_NAME } from "./tools/registry.js";
import { COVERS_BASE_URL } from "./utils/http.js";
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
  let apiClient: { get: Mock; head: Mock };
  let coversClient: { get: Mock; head: Mock };

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
    apiClient = { get: vi.fn(), head: vi.fn() };
    coversClient = { get: vi.fn(), head: vi.fn() };
    // Both clients are created in the constructor, so this has to be in place
    // before the server is built. They are kept distinct so that a tool
    // reaching for the wrong host fails the assertions rather than passing.
    mockedAxios.create.mockImplementation(((config?: { baseURL?: string }) =>
      config?.baseURL === COVERS_BASE_URL ? coversClient : apiClient) as any);
    new OpenLibraryServer();
    mockMcpServer = (Server as any).mock.results[0].value;
  });

  afterEach(() => {
    // clearAllMocks resets calls but leaves spies installed, so the
    // console.error stub below would otherwise outlive its test.
    vi.restoreAllMocks();
  });

  // Signal handling belongs to run(), not construction. The suite builds a
  // server per test, so a listener registered in the constructor accumulated
  // once per case and tripped Node's max-listeners warning.
  it("does not register a process listener when constructed", () => {
    const before = process.listenerCount("SIGINT");

    new OpenLibraryServer();

    expect(process.listenerCount("SIGINT")).toBe(before);
  });

  it("reports the version from package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    const [implementation] = (Server as any).mock.calls[0];

    expect(implementation.version).toBe(pkg.version);
    expect(implementation.name).toBe("mcp-open-library");
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
      apiClient.get.mockResolvedValue({
        data: { numFound: 1, docs: [{ title: "Dune", key: "/works/OL1W" }] },
      });

      const result = await callTool("search_books", { q: "dune", limit: 1 });

      expect(apiClient.get).toHaveBeenCalledWith("/search.json", {
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
      apiClient.get.mockResolvedValue({ data: { numFound: 1, docs } });

      const result = await callTool("get_authors_by_name", {
        name: "J. R. R. Tolkien",
      });

      expect(apiClient.get).toHaveBeenCalledWith("/search/authors.json", {
        params: { q: "J. R. R. Tolkien", limit: 10, offset: 0 },
      });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual({
        num_found: 1,
        offset: 0,
        limit: 10,
        results: docs,
      });
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
      apiClient.get.mockResolvedValue({ data });

      const result = await callTool("get_author_info", {
        author_key: "OL23919A",
      });

      expect(apiClient.get).toHaveBeenCalledWith("/authors/OL23919A.json");
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });

    it("handles get_author_photo against the covers host", async () => {
      coversClient.head.mockResolvedValue({ status: 200 });

      const result = await callTool("get_author_photo", { olid: "OL23919A" });

      expect(coversClient.head).toHaveBeenCalledWith("/a/olid/OL23919A-L.jpg", {
        params: { default: false },
      });
      expect(apiClient.head).not.toHaveBeenCalled();
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
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    // Everything the tool itself raises comes back as a tool error instead, so
    // the model can read what was wrong and fix its next call.
    it("returns rejected arguments as a tool error, not a protocol error", async () => {
      const result = await callTool("search_books", { q: "dune", limit: 51 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "Invalid arguments for search_books: limit: Too big: expected number to be <=50",
      );
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("returns a missing search criterion as a tool error naming the options", async () => {
      const result = await callTool("search_books", { limit: 5 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Provide at least one search criterion: q, title, author, subject, place, person, publisher, isbn",
      );
    });

    it("converts an unexpected handler throw into a tool error", async () => {
      apiClient.get.mockImplementation(() => {
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

    // The boundary in src/index.ts is the backstop for a handler bug: without
    // it, a throw escaping a handler's own catch would break the call instead of
    // reaching the model. Every handler catches its request failures, so the
    // only way to exercise it is to throw past one.
    it("converts a throw that escapes a handler into a tool error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const tool = TOOLS_BY_NAME.get("get_author_info");
      vi.spyOn(tool!, "handler").mockRejectedValue(new TypeError("boom"));

      const result = await callTool("get_author_info", {
        author_key: "OL23919A",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "Unexpected error in get_author_info: boom",
      );
    });
  });
});
