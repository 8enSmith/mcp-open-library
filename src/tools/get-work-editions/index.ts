import { AxiosInstance } from "axios";
import { z } from "zod";

import { isNotFound, parseArgs, toErrorResult } from "../../utils/errors.js";
import { errorTextResult, jsonResult } from "../../utils/results.js";
import { normaliseIsbn } from "../../utils/search.js";
import {
  fetchWork,
  firstCoverUrl,
  toBareKey,
  withoutEmpty,
  workKeySchema,
} from "../../utils/works.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import {
  EditionSummary,
  OpenLibraryEditionRecord,
  OpenLibraryEditionsResponse,
  WorkEditions,
} from "./types.js";

export const DEFAULT_EDITIONS_LIMIT = 20;
export const MAX_EDITIONS_LIMIT = 100;

export const GetWorkEditionsArgsSchema = z.object({
  work_key: workKeySchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_EDITIONS_LIMIT)
    .default(DEFAULT_EDITIONS_LIMIT)
    .describe(
      `Maximum number of editions to return (1-${MAX_EDITIONS_LIMIT}, default ${DEFAULT_EDITIONS_LIMIT}).`,
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Number of editions to skip, for paging through the total reported as num_found (default 0).",
    ),
});

interface Paging {
  limit: number;
  offset: number;
}

interface FoundEditions {
  workKey: string;
  page: OpenLibraryEditionsResponse;
}

async function getEditionsPage(
  api: AxiosInstance,
  workKey: string,
  params: Paging,
): Promise<OpenLibraryEditionsResponse | undefined> {
  try {
    const response = await api.get<OpenLibraryEditionsResponse>(
      `/works/${workKey}/editions.json`,
      { params },
    );
    return response.data ?? {};
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

async function findEditions(
  api: AxiosInstance,
  workKey: string,
  params: Paging,
): Promise<FoundEditions | undefined> {
  const page = await getEditionsPage(api, workKey, params);
  if (page) {
    return { workKey, page };
  }

  const lookup = await fetchWork(api, workKey);
  if (!lookup.found || lookup.key === workKey) {
    return undefined;
  }

  const canonicalPage = await getEditionsPage(api, lookup.key, params);
  return canonicalPage && { workKey: lookup.key, page: canonicalPage };
}

function firstIsbn(values: string[] | undefined): string | undefined {
  const [first] = values ?? [];
  return first === undefined ? undefined : normaliseIsbn(first);
}

function toEditionSummary(record: OpenLibraryEditionRecord): EditionSummary {
  return withoutEmpty({
    edition_key: toBareKey(record.key),
    title: record.title,
    subtitle: record.subtitle,
    edition_name: record.edition_name,
    publishers: record.publishers,
    publish_date: record.publish_date,
    languages: record.languages?.map(({ key }) => toBareKey(key)),
    isbn_13: firstIsbn(record.isbn_13),
    isbn_10: firstIsbn(record.isbn_10),
    number_of_pages: record.number_of_pages,
    physical_format: record.physical_format,
    cover_url: firstCoverUrl(record.covers),
  });
}

const handleGetWorkEditions: ToolHandler = async (args, clients) => {
  const {
    work_key: workKey,
    limit,
    offset,
  } = parseArgs(GetWorkEditionsArgsSchema, args, "get_work_editions");

  try {
    const found = await findEditions(clients.api, toBareKey(workKey), {
      limit,
      offset,
    });

    if (!found) {
      return errorTextResult(`No work found for key: ${workKey}`);
    }

    const result: WorkEditions = {
      work_key: found.workKey,
      num_found: found.page.size ?? 0,
      offset,
      limit,
      editions: (found.page.entries ?? []).map(toEditionSummary),
    };

    return jsonResult(result);
  } catch (error) {
    return toErrorResult(error, "get_work_editions");
  }
};

export const getWorkEditionsTool: ToolDefinition = {
  name: "get_work_editions",
  title: "List editions of a work",
  description:
    "List the editions of an Open Library work — its specific printings, each with publisher, date, language, ISBNs, page count and format. Takes the `open_library_work_key` returned by `search_books`, `get_book_by_title` or `get_book_by_id`. Returns at most `limit` editions (default 20, maximum 100) with `num_found`, the total; page through them with `offset`. Editions are in Open Library's order, not by date, and cannot be filtered. Pass an edition's `edition_key` to `get_book_by_id` as `{ idType: \"olid\" }` for its full record.",
  schema: GetWorkEditionsArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetWorkEditions,
};

export { handleGetWorkEditions };
