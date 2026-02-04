import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, it, expect } from "vitest";

import { handleGetAuthorPhoto } from "./index.js";

describe("handleGetAuthorPhoto", () => {
  it("should return the correct photo URL for a valid OLID", async () => {
    const args = { olid: "OL23919A" }; // Example valid OLID
    const expectedUrl = "https://covers.openlibrary.org/a/olid/OL23919A-L.jpg";
    const result = await handleGetAuthorPhoto(args);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expectedUrl,
        },
      ],
    });
  });

  it("should throw McpError for invalid OLID format", async () => {
    const args = { olid: "invalid-olid-format" };
    await expect(handleGetAuthorPhoto(args)).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_author_photo: olid: OLID must be in the format OL<number>A",
      ),
    );
  });

  it("should throw McpError for empty OLID", async () => {
    const args = { olid: "" };
    await expect(handleGetAuthorPhoto(args)).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_author_photo: olid: OLID cannot be empty, olid: OLID must be in the format OL<number>A",
      ),
    );
  });

  it("should throw McpError if OLID is missing", async () => {
    const args = {}; // Missing olid property
    // Zod's default message for required fields might vary slightly, adjust if needed
    await expect(handleGetAuthorPhoto(args)).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_author_photo: olid: Invalid input: expected string, received undefined",
      ),
    );
  });

  it("should throw McpError for non-object arguments", async () => {
    const args = null; // Invalid argument type
    await expect(handleGetAuthorPhoto(args)).rejects.toThrow(
      new McpError(
        ErrorCode.InvalidParams,
        "Invalid arguments for get_author_photo: : Invalid input: expected object, received null",
      ),
    );
  });
});
