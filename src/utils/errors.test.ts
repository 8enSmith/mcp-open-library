import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

import {
  describeError,
  InvalidArgumentsError,
  isNotFound,
  parseArgs,
  toErrorResult,
  toToolError,
} from "./errors.js";

function axiosErrorWithStatus(status: number, statusText?: string) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: statusText ?? "",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    },
  );
}

describe("parseArgs", () => {
  const schema = z.object({
    name: z.string().min(1, { message: "Name cannot be empty" }),
    count: z.number().int().default(1),
  });

  it("returns the parsed value, applying defaults", () => {
    expect(parseArgs(schema, { name: "ok" }, "some_tool")).toEqual({
      name: "ok",
      count: 1,
    });
  });

  it("throws InvalidArgumentsError", () => {
    try {
      parseArgs(schema, { name: "" }, "some_tool");
      expect.unreachable("expected parseArgs to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentsError);
    }
  });

  it("formats issues as `path: message`, joined by commas", () => {
    expect(() =>
      parseArgs(schema, { name: "", count: 1.5 }, "some_tool"),
    ).toThrow(
      "Invalid arguments for some_tool: name: Name cannot be empty, count: Invalid input: expected int, received number",
    );
  });

  it("uses an empty path for root-level issues", () => {
    expect(() => parseArgs(schema, null, "some_tool")).toThrow(
      "Invalid arguments for some_tool: : Invalid input: expected object, received null",
    );
  });
});

describe("isNotFound", () => {
  it("is true only for axios errors carrying a 404", () => {
    expect(isNotFound(axiosErrorWithStatus(404, "Not Found"))).toBe(true);
    expect(isNotFound(axiosErrorWithStatus(500, "Server Error"))).toBe(false);
    expect(isNotFound(new Error("nope"))).toBe(false);
    expect(isNotFound("nope")).toBe(false);
  });
});

describe("describeError", () => {
  it("includes the status code and reason phrase", () => {
    expect(
      describeError(axiosErrorWithStatus(503, "Service Unavailable")),
    ).toBe("Open Library API error: 503 Service Unavailable");
  });

  it("includes the status code alone when there is no reason phrase", () => {
    expect(describeError(axiosErrorWithStatus(503))).toBe(
      "Open Library API error: 503",
    );
  });

  it("falls back to the message when there is no response", () => {
    const error = new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED");
    expect(describeError(error)).toBe(
      "Open Library API error: timeout of 15000ms exceeded",
    );
  });

  it("handles plain errors", () => {
    expect(describeError(new Error("boom"))).toBe(
      "Open Library API error: boom",
    );
  });

  it("handles non-error values", () => {
    expect(describeError("boom")).toBe("Open Library API error: unknown error");
  });
});

describe("toErrorResult", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an error result and logs the cause", () => {
    const error = new Error("boom");

    expect(toErrorResult(error, "some_tool")).toEqual({
      content: [{ type: "text", text: "Open Library API error: boom" }],
      isError: true,
    });
    expect(console.error).toHaveBeenCalledWith("Error in some_tool:", error);
  });
});

describe("toToolError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Per the MCP spec, a tool's own errors belong in the result with
  // isError: true so the model can see them and self-correct — not as a
  // JSON-RPC error, which the client would raise before the model sees it.
  it("turns rejected arguments into a tool error carrying the message verbatim", () => {
    const error = new InvalidArgumentsError(
      "Invalid arguments for some_tool: limit: Too big: expected number to be <=50",
    );

    expect(toToolError(error, "some_tool")).toEqual({
      content: [
        {
          type: "text",
          text: "Invalid arguments for some_tool: limit: Too big: expected number to be <=50",
        },
      ],
      isError: true,
    });
  });

  it("does not log rejected arguments, which are the caller's mistake", () => {
    toToolError(new InvalidArgumentsError("nope"), "some_tool");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("turns an unexpected throw into a tool error and logs it", () => {
    const error = new TypeError("cannot read properties of undefined");

    expect(toToolError(error, "some_tool")).toEqual({
      content: [
        {
          type: "text",
          text: "Unexpected error in some_tool: cannot read properties of undefined",
        },
      ],
      isError: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Unexpected error in some_tool:",
      error,
    );
  });

  it("handles a thrown non-error value", () => {
    expect(toToolError("kaboom", "some_tool").content).toEqual([
      { type: "text", text: "Unexpected error in some_tool: kaboom" },
    ]);
  });
});
