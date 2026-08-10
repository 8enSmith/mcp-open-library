import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";

import { errorTextResult } from "./results.js";

/**
 * Thrown when a tool's arguments fail validation. `CallTool` turns this into a
 * result with `isError: true` rather than a JSON-RPC error, so the model can
 * read what was wrong and correct its next call — see `toToolError`.
 */
export class InvalidArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgumentsError";
  }
}

export function parseArgs<S extends z.ZodType>(
  schema: S,
  args: unknown,
  toolName: string,
): z.infer<S> {
  const parseResult = schema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new InvalidArgumentsError(
      `Invalid arguments for ${toolName}: ${errorMessages}`,
    );
  }

  return parseResult.data as z.infer<S>;
}

export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const { status, statusText } = error.response ?? {};
    const detail = status
      ? `${status}${statusText ? ` ${statusText}` : ""}`
      : error.message;
    return `Open Library API error: ${detail}`;
  }

  if (error instanceof Error) {
    return `Open Library API error: ${error.message}`;
  }

  return "Open Library API error: unknown error";
}

export function toErrorResult(
  error: unknown,
  toolName: string,
): CallToolResult {
  console.error(`Error in ${toolName}:`, error);

  return errorTextResult(describeError(error));
}

/**
 * The `CallTool` boundary: anything a handler throws becomes a tool error, not
 * a protocol error. Per the MCP spec, errors originating from a tool "SHOULD be
 * reported inside the result object, with `isError` set to `true` ... Otherwise,
 * the LLM would not be able to see that an error occurred and self-correct."
 * Only failures in *finding* a tool stay protocol-level.
 */
export function toToolError(error: unknown, toolName: string): CallToolResult {
  if (error instanceof InvalidArgumentsError) {
    return errorTextResult(error.message);
  }

  console.error(`Unexpected error in ${toolName}:`, error);

  const detail = error instanceof Error ? error.message : String(error);
  return errorTextResult(`Unexpected error in ${toolName}: ${detail}`);
}
