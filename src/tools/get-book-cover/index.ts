import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Schema for the get_book_cover tool arguments
export const GetBookCoverArgsSchema = z.object({
  key: z.enum(["ISBN", "OCLC", "LCCN", "OLID", "ID"], {
    message: "Key must be one of ISBN, OCLC, LCCN, OLID, ID",
  }),
  value: z.string().min(1, { message: "Value cannot be empty" }),
  size: z
    .nullable(z.enum(["S", "M", "L"]))
    .optional()
    .transform((val) => val || "L"),
});

const handleGetBookCover = async (args: unknown) => {
  const parseResult = GetBookCoverArgsSchema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for get_book_cover: ${errorMessages}`,
    );
  }

  const { key, value, size } = parseResult.data;

  // Construct the URL according to the Open Library Covers API format
  const coverUrl = `https://covers.openlibrary.org/b/${key.toLowerCase()}/${value}-${size}.jpg`;

  return {
    content: [
      {
        type: "text",
        text: coverUrl,
      },
    ],
  };
  // No try/catch needed here as we are just constructing a URL string based on validated input.
};

export { handleGetBookCover };
