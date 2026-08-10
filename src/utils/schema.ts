import { z } from "zod";

export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * `io: "input"` is required. The default ("output") throws on schemas
 * containing transforms, and marks defaulted fields as required — neither is
 * correct for an MCP input schema. Note that `.refine()` constraints are
 * dropped entirely, so cross-field rules must also be stated in the tool
 * description.
 */
export function toInputSchema(schema: z.ZodType): JsonSchemaObject {
  const jsonSchema = z.toJSONSchema(schema, { io: "input" }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;
  return jsonSchema as JsonSchemaObject;
}
