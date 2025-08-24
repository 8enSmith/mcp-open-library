#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

import {
  handleGetAuthorPhoto,
  handleGetBookByTitle,
  handleGetBookCover,
  handleGetAuthorsByName,
  handleGetAuthorInfo,
  handleGetBookById,
} from "./tools/index.js";

class OpenLibraryServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: "open-library-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      },
    );

    this.axiosInstance = axios.create({
      baseURL: "https://openlibrary.org",
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_book_by_title",
          description: "Search for a book by its title on Open Library.",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the book to search for.",
              },
            },
            required: ["title"],
          },
        },
        {
          name: "get_authors_by_name",
          description: "Search for author information on Open Library.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the author to search for.",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "get_author_info",
          description:
            "Get detailed information for a specific author using their Open Library Author Key (e.g. OL23919A).",
          inputSchema: {
            type: "object",
            properties: {
              author_key: {
                type: "string",
                description:
                  "The Open Library key for the author (e.g., OL23919A).",
              },
            },
            required: ["author_key"],
          },
        },
        {
          name: "get_author_photo",
          description:
            "Get the URL for an author's photo using their Open Library Author ID (OLID e.g. OL23919A).",
          inputSchema: {
            type: "object",
            properties: {
              olid: {
                type: "string",
                description:
                  "The Open Library Author ID (OLID) for the author (e.g. OL23919A).",
              },
            },
            required: ["olid"],
          },
        },
        {
          name: "get_book_cover",
          description:
            "Get the URL for a book's cover image using a key (ISBN, OCLC, LCCN, OLID, ID) and value.",
          inputSchema: {
            type: "object",
            properties: {
              key: {
                type: "string",
                // ID is internal cover ID
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
          },
        },
        {
          name: "get_book_by_id",
          description:
            "Get detailed information about a book using its identifier (ISBN, LCCN, OCLC, OLID).",
          inputSchema: {
            type: "object",
            properties: {
              idType: {
                type: "string",
                enum: ["isbn", "lccn", "oclc", "olid"],
                description:
                  "The type of identifier used (ISBN, LCCN, OCLC, OLID).",
              },
              idValue: {
                type: "string",
                description: "The value of the identifier.",
              },
            },
            required: ["idType", "idValue"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "get_book_by_title":
          return handleGetBookByTitle(args, this.axiosInstance);
        case "get_authors_by_name":
          return handleGetAuthorsByName(args, this.axiosInstance);
        case "get_author_info":
          return handleGetAuthorInfo(args, this.axiosInstance);
        case "get_author_photo":
          return handleGetAuthorPhoto(args);
        case "get_book_cover":
          return handleGetBookCover(args);
        case "get_book_by_id":
          return handleGetBookById(args, this.axiosInstance);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Open Library MCP server running on stdio");
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const server = new OpenLibraryServer();
  server.run().catch(console.error);
}

export { OpenLibraryServer };
