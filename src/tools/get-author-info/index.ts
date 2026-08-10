import { z } from "zod";

import { isNotFound, parseArgs, toErrorResult } from "../../utils/errors.js";
import {
  errorTextResult,
  jsonResult,
  textResult,
} from "../../utils/results.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import { DetailedAuthorInfo } from "./types.js";

export const GetAuthorInfoArgsSchema = z.object({
  author_key: z
    .string()
    .min(1, { message: "Author key cannot be empty" })
    .regex(/^OL\d+A$/, {
      message: "Author key must be in the format OL<number>A",
    })
    .describe("The Open Library key for the author (e.g., OL23919A)."),
});

const handleGetAuthorInfo: ToolHandler = async (args, clients) => {
  const { author_key: authorKey } = parseArgs(
    GetAuthorInfoArgsSchema,
    args,
    "get_author_info",
  );

  try {
    const response = await clients.api.get<DetailedAuthorInfo>(
      `/authors/${authorKey}.json`,
    );

    if (!response.data) {
      return textResult(`No data found for author key: "${authorKey}"`);
    }

    const authorData = { ...response.data };
    if (typeof authorData.bio === "object" && authorData.bio !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorData.bio = (authorData.bio as any).value;
    }

    return jsonResult(authorData);
  } catch (error) {
    if (isNotFound(error)) {
      return errorTextResult(`Author with key "${authorKey}" not found.`);
    }
    return toErrorResult(error, "get_author_info");
  }
};

export const getAuthorInfoTool: ToolDefinition = {
  name: "get_author_info",
  title: "Get author details",
  description:
    "Get detailed information for a specific author using their Open Library Author Key (e.g. OL23919A).",
  schema: GetAuthorInfoArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetAuthorInfo,
};

export { handleGetAuthorInfo };
