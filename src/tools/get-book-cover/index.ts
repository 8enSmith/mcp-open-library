import { z } from "zod";

import { resolveCoverUrl } from "../../utils/covers.js";
import { parseArgs } from "../../utils/errors.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

export const GetBookCoverArgsSchema = z.object({
  key: z
    .enum(["ISBN", "OCLC", "LCCN", "OLID", "ID"], {
      message: "Key must be one of ISBN, OCLC, LCCN, OLID, ID",
    })
    .describe(
      "The type of identifier used (ISBN, OCLC, LCCN, OLID, ID). ID is Open Library's internal cover ID.",
    ),
  value: z
    .string()
    .min(1, { message: "Value cannot be empty" })
    .describe("The value of the identifier."),
  size: z
    .enum(["S", "M", "L"])
    .default("L")
    .describe("The desired size of the cover (S, M, or L). Defaults to L."),
});

const handleGetBookCover: ToolHandler = async (args, clients) => {
  const { key, value, size } = parseArgs(
    GetBookCoverArgsSchema,
    args,
    "get_book_cover",
  );

  return resolveCoverUrl(
    clients.covers,
    `/b/${key.toLowerCase()}/${value}-${size}.jpg`,
    `No cover image available for ${key} ${value}.`,
    "get_book_cover",
  );
};

export const getBookCoverTool: ToolDefinition = {
  name: "get_book_cover",
  title: "Get book cover URL",
  description:
    "Get the URL for a book's cover image using a key (ISBN, OCLC, LCCN, OLID, ID) and value. Reports when no cover exists rather than returning a URL to a blank placeholder.",
  schema: GetBookCoverArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetBookCover,
};

export { handleGetBookCover };
