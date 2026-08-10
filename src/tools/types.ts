import {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { OpenLibraryClients } from "../utils/http.js";

export type ToolHandler = (
  args: unknown,
  clients: OpenLibraryClients,
) => Promise<CallToolResult>;

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType;
  annotations?: ToolAnnotations;
  handler: ToolHandler;
}

/**
 * Every tool here is a read-only lookup against Open Library, so clients can
 * skip the confirmation prompt they would otherwise show. `openWorldHint`
 * flags that the data comes from an external service. `destructiveHint` and
 * `idempotentHint` are only meaningful when `readOnlyHint` is false, so they
 * are deliberately omitted.
 */
export const READ_ONLY_LOOKUP: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
};
