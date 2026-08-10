#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS, TOOLS_BY_NAME } from "./tools/registry.js";
import { toToolError } from "./utils/errors.js";
import { createOpenLibraryClients, OpenLibraryClients } from "./utils/http.js";
import { toInputSchema } from "./utils/schema.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

class OpenLibraryServer {
  private server: Server;
  private clients: OpenLibraryClients;

  constructor() {
    this.server = new Server(
      {
        name: "open-library-server",
        version: pkg.version,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      },
    );

    this.clients = createOpenLibraryClients(pkg.version);

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: toInputSchema(tool.schema),
        annotations: tool.annotations,
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = TOOLS_BY_NAME.get(name);

      // Failing to *find* a tool is a protocol error; everything a tool itself
      // raises — including rejected arguments — comes back as a tool error the
      // model can read and correct.
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        return await tool.handler(args, this.clients);
      } catch (error) {
        return toToolError(error, name);
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
