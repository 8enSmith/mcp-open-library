import { z } from "zod";

import { parseArgs, toErrorResult } from "../../utils/errors.js";
import { jsonResult, textResult } from "../../utils/results.js";
import {
  OpenLibrarySearchResponse,
  SEARCH_FIELDS,
  searchLimitSchema,
  searchOffsetSchema,
  toSearchResults,
} from "../../utils/search.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

export const GetBookByTitleArgsSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title cannot be empty" })
    .describe("The title of the book to search for."),
  limit: searchLimitSchema,
  offset: searchOffsetSchema,
});

const handleGetBookByTitle: ToolHandler = async (args, clients) => {
  const { title, limit, offset } = parseArgs(
    GetBookByTitleArgsSchema,
    args,
    "get_book_by_title",
  );

  try {
    const response = await clients.api.get<OpenLibrarySearchResponse>(
      "/search.json",
      {
        params: { title, fields: SEARCH_FIELDS, limit, offset },
      },
    );

    if (!response.data?.docs?.length) {
      return textResult(`No books found matching title: "${title}"`);
    }

    return jsonResult(toSearchResults(response.data, limit, offset));
  } catch (error) {
    return toErrorResult(error, "get_book_by_title");
  }
};

export const getBookByTitleTool: ToolDefinition = {
  name: "get_book_by_title",
  title: "Find books by title",
  description:
    'Search for a book by its title on Open Library. Returns at most `limit` results (default 10) together with `num_found`, the total number of matches; page through them with `offset`. Each result carries `best_edition` — one edition of the work, with its `isbn_13`/`isbn_10` where Open Library has them, and its `edition_key`, which can be passed to `get_book_by_id` as `{ idType: "olid" }` for that edition\'s full record.',
  schema: GetBookByTitleArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetBookByTitle,
};

export { handleGetBookByTitle };
