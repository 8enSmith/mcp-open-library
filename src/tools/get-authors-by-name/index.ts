import { z } from "zod";

import { parseArgs, toErrorResult } from "../../utils/errors.js";
import { jsonResult, textResult } from "../../utils/results.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import { AuthorInfo, OpenLibraryAuthorSearchResponse } from "./types.js";

export const GetAuthorsByNameArgsSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Author name cannot be empty" })
    .describe("The name of the author to search for."),
});

const handleGetAuthorsByName: ToolHandler = async (args, clients) => {
  const { name: authorName } = parseArgs(
    GetAuthorsByNameArgsSchema,
    args,
    "get_authors_by_name",
  );

  try {
    const response = await clients.api.get<OpenLibraryAuthorSearchResponse>(
      "/search/authors.json",
      {
        params: { q: authorName },
      },
    );

    if (!response.data?.docs?.length) {
      return textResult(`No authors found matching name: "${authorName}"`);
    }

    const authorResults: AuthorInfo[] = response.data.docs.map((doc) => ({
      key: doc.key,
      name: doc.name,
      alternate_names: doc.alternate_names,
      birth_date: doc.birth_date,
      top_work: doc.top_work,
      work_count: doc.work_count,
    }));

    return jsonResult(authorResults);
  } catch (error) {
    return toErrorResult(error, "get_authors_by_name");
  }
};

export const getAuthorsByNameTool: ToolDefinition = {
  name: "get_authors_by_name",
  title: "Find authors by name",
  description: "Search for author information on Open Library.",
  schema: GetAuthorsByNameArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetAuthorsByName,
};

export { handleGetAuthorsByName };
