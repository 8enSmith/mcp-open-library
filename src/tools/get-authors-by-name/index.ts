import { z } from "zod";

import { parseArgs, toErrorResult } from "../../utils/errors.js";
import { jsonResult, textResult } from "../../utils/results.js";
import { searchLimitSchema, searchOffsetSchema } from "../../utils/search.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import {
  AuthorInfo,
  AuthorSearchResults,
  OpenLibraryAuthorSearchResponse,
} from "./types.js";

export const GetAuthorsByNameArgsSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Author name cannot be empty" })
    .describe("The name of the author to search for."),
  limit: searchLimitSchema,
  offset: searchOffsetSchema,
});

const handleGetAuthorsByName: ToolHandler = async (args, clients) => {
  const {
    name: authorName,
    limit,
    offset,
  } = parseArgs(GetAuthorsByNameArgsSchema, args, "get_authors_by_name");

  try {
    const response = await clients.api.get<OpenLibraryAuthorSearchResponse>(
      "/search/authors.json",
      {
        params: { q: authorName, limit, offset },
      },
    );

    if (!response.data?.docs?.length) {
      return textResult(`No authors found matching name: "${authorName}"`);
    }

    const results: AuthorInfo[] = response.data.docs.map((doc) => ({
      key: doc.key,
      name: doc.name,
      alternate_names: doc.alternate_names,
      birth_date: doc.birth_date,
      top_work: doc.top_work,
      work_count: doc.work_count,
    }));

    const authorResults: AuthorSearchResults = {
      num_found: response.data.numFound ?? results.length,
      offset,
      limit,
      results,
    };

    return jsonResult(authorResults);
  } catch (error) {
    return toErrorResult(error, "get_authors_by_name");
  }
};

export const getAuthorsByNameTool: ToolDefinition = {
  name: "get_authors_by_name",
  title: "Find authors by name",
  description:
    "Search for author information on Open Library. Returns at most `limit` authors (default 10) together with `num_found`, the total number of matches; page through them with `offset`. Each result's `key` can be passed to `get_author_info` for that author's full record.",
  schema: GetAuthorsByNameArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetAuthorsByName,
};

export { handleGetAuthorsByName };
