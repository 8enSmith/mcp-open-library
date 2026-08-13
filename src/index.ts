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
import { isMainModule } from "./utils/main-module.js";
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
        name: "mcp-open-library",
        version: pkg.version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.clients = createOpenLibraryClients(pkg.version);

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
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

  // Registered here rather than in the constructor: the handler exists to close
  // a connected transport, and a process-wide listener is a side effect that
  // merely constructing the server should not have. Tests build one per case,
  // which accumulated listeners past Node's warning threshold.
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });

    console.error("Open Library MCP server running on stdio");
  }
}

if (isMainModule(import.meta.url)) {
  const server = new OpenLibraryServer();
  server.run().catch(console.error);
}

export { OpenLibraryServer };
