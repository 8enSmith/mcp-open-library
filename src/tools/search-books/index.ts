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

export const SEARCH_CRITERIA = [
  "q",
  "title",
  "author",
  "subject",
  "place",
  "person",
  "publisher",
  "isbn",
] as const;

export const SORT_VALUES = [
  "new",
  "old",
  "random",
  "key",
  "rating",
  "readinglog",
  "want_to_read",
  "currently_reading",
  "already_read",
  "title",
] as const;

const CRITERIA_MESSAGE = `Provide at least one search criterion: ${SEARCH_CRITERIA.join(", ")}`;

export const SearchBooksArgsSchema = z
  .object({
    q: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Free-form query searched across all fields. Supports Solr syntax, e.g. `subject:cyberpunk AND first_publish_year:[1980 TO 1990]`.",
      ),
    title: z.string().min(1).optional().describe("Search by book title."),
    author: z.string().min(1).optional().describe("Search by author name."),
    subject: z.string().min(1).optional().describe("Search by subject."),
    place: z
      .string()
      .min(1)
      .optional()
      .describe("Search by a place the book is about."),
    person: z
      .string()
      .min(1)
      .optional()
      .describe("Search by a person the book is about."),
    publisher: z.string().min(1).optional().describe("Search by publisher."),
    isbn: z
      .string()
      .min(1)
      .optional()
      .describe("Search by ISBN-10 or ISBN-13."),
    language: z
      .string()
      .min(3)
      .max(3)
      .optional()
      .describe(
        "Restrict results to a language, as a 3-letter MARC code (e.g. eng, fre, spa).",
      ),
    sort: z
      .enum(SORT_VALUES)
      .optional()
      .describe(
        "Result ordering. Omit for relevance. `new`/`old` order by first publication date, `rating` by average rating.",
      ),
    limit: searchLimitSchema,
    offset: searchOffsetSchema,
  })
  .refine((value) => SEARCH_CRITERIA.some((key) => Boolean(value[key])), {
    message: CRITERIA_MESSAGE,
  });

function describeCriteria(
  criteria: Partial<
    Record<(typeof SEARCH_CRITERIA)[number] | "language", string>
  >,
): string {
  return Object.entries(criteria)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}="${value}"`)
    .join(", ");
}

const handleSearchBooks: ToolHandler = async (args, clients) => {
  const { limit, offset, sort, language, ...criteria } = parseArgs(
    SearchBooksArgsSchema,
    args,
    "search_books",
  );

  const params: Record<string, string | number> = {
    fields: SEARCH_FIELDS,
    limit,
    offset,
  };

  for (const key of SEARCH_CRITERIA) {
    const value = criteria[key];
    if (value) {
      params[key] = value;
    }
  }

  if (language) {
    params.language = language;
  }

  if (sort) {
    params.sort = sort;
  }

  try {
    const response = await clients.api.get<OpenLibrarySearchResponse>(
      "/search.json",
      { params },
    );

    if (!response.data?.docs?.length) {
      return textResult(
        `No books found matching: ${describeCriteria({ ...criteria, language })}`,
      );
    }

    return jsonResult(toSearchResults(response.data, limit, offset));
  } catch (error) {
    return toErrorResult(error, "search_books");
  }
};

export const searchBooksTool: ToolDefinition = {
  name: "search_books",
  title: "Search books",
  description: `Search Open Library across titles, authors, subjects, places, people, publishers and ISBNs. ${CRITERIA_MESSAGE}; combining several narrows the search. Returns at most \`limit\` results (default 10) together with \`num_found\`, the total number of matches; page through them with \`offset\`.`,
  schema: SearchBooksArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleSearchBooks,
};

export { handleSearchBooks };
