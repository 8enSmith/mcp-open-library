import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toInputSchema } from "./schema.js";

describe("toInputSchema", () => {
  it("strips the $schema key the MCP tool listing does not need", () => {
    const result = toInputSchema(z.object({ a: z.string() }));

    expect(result).not.toHaveProperty("$schema");
    expect(result.type).toBe("object");
  });

  it("carries .describe() text through to the property description", () => {
    const result = toInputSchema(
      z.object({ a: z.string().describe("The a value.") }),
    );

    expect(result.properties?.a).toMatchObject({
      type: "string",
      description: "The a value.",
    });
  });

  it("advertises defaults without marking the field required", () => {
    const result = toInputSchema(
      z.object({
        required: z.string(),
        optional: z.number().int().default(10),
      }),
    );

    expect(result.required).toEqual(["required"]);
    expect(result.properties?.optional).toMatchObject({ default: 10 });
  });

  it("keeps enums intact", () => {
    const result = toInputSchema(z.object({ size: z.enum(["S", "M", "L"]) }));

    expect(result.properties?.size).toMatchObject({ enum: ["S", "M", "L"] });
  });

  it("does not throw on schemas containing a transform", () => {
    const schema = z.object({
      value: z
        .string()
        .transform((v) => v.toLowerCase())
        .pipe(z.enum(["a", "b"])),
    });

    expect(() => toInputSchema(schema)).not.toThrow();
  });

  it("drops .refine() constraints, which must therefore be documented in the tool description", () => {
    const schema = z
      .object({ a: z.string().optional(), b: z.string().optional() })
      .refine((v) => Boolean(v.a || v.b), { message: "need one" });

    const result = toInputSchema(schema);

    expect(JSON.stringify(result)).not.toContain("need one");
  });
});
