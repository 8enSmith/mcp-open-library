import {
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Schema for the get_author_photo tool arguments
export const GetAuthorPhotoArgsSchema = z.object({
  olid: z
    .string()
    .min(1, { message: "OLID cannot be empty" })
    .regex(/^OL\d+A$/, {
      // Escaped backslash for regex in string
      message: "OLID must be in the format OL<number>A",
    }),
});

// Handler function for the get_author_photo tool
const handleGetAuthorPhoto = async (args: unknown): Promise<CallToolResult> => {
  const parseResult = GetAuthorPhotoArgsSchema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for get_author_photo: ${errorMessages}`,
    );
  }

  const olid = parseResult.data.olid;
  const photoUrl = `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`; // Use -L for large size

  // Note: We don't actually fetch the image here, just return the URL.
  // The Open Library Covers API doesn't provide a way to check if an image exists
  // other than trying to fetch it. We assume the URL is correct if the OLID format is valid.

  return {
    content: [
      {
        type: "text",
        text: photoUrl,
      },
    ],
  };
  // No try/catch needed here as we are just constructing a URL string based on validated input.
};

export { handleGetAuthorPhoto };
