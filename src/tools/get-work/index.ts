import { AxiosInstance } from "axios";
import { z } from "zod";

import { parseArgs, toErrorResult } from "../../utils/errors.js";
import { errorTextResult, jsonResult } from "../../utils/results.js";
import {
  fetchWork,
  firstCoverUrl,
  OpenLibraryWorkRecord,
  toBareKey,
  withoutEmpty,
  workKeySchema,
} from "../../utils/works.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import { AuthorNamesSearchResponse, WorkAuthor, WorkDetails } from "./types.js";

export const GetWorkArgsSchema = z.object({
  work_key: workKeySchema,
});

const AUTHOR_NAME_FIELDS = "author_key,author_name";

async function fetchAuthorNames(
  api: AxiosInstance,
  workKey: string,
): Promise<Map<string, string>> {
  try {
    const response = await api.get<AuthorNamesSearchResponse>("/search.json", {
      params: {
        q: `key:/works/${workKey}`,
        fields: AUTHOR_NAME_FIELDS,
        limit: 1,
      },
    });
    const doc = response.data?.docs?.[0];
    const keys = doc?.author_key ?? [];
    const names = doc?.author_name ?? [];

    if (keys.length !== names.length) {
      return new Map();
    }

    return new Map(
      keys.flatMap((key, index): [string, string][] =>
        names[index] ? [[key, names[index]]] : [],
      ),
    );
  } catch (error) {
    console.error("Error looking up author names in get_work:", error);
    return new Map();
  }
}

function toAuthors(
  work: OpenLibraryWorkRecord,
  names: Map<string, string>,
): WorkAuthor[] {
  return (work.authors ?? []).flatMap(({ author }) => {
    const rawKey = typeof author === "string" ? author : author?.key;
    if (!rawKey) {
      return [];
    }
    const key = toBareKey(rawKey);
    const name = names.get(key);
    return [name === undefined ? { key } : { key, name }];
  });
}

function flattenDescription(
  description: OpenLibraryWorkRecord["description"],
): string | undefined {
  return typeof description === "string" ? description : description?.value;
}

function toWorkDetails(
  workKey: string,
  work: OpenLibraryWorkRecord,
  names: Map<string, string>,
): WorkDetails {
  return withoutEmpty({
    work_key: workKey,
    title: work.title,
    subtitle: work.subtitle,
    authors: toAuthors(work, names),
    description: flattenDescription(work.description),
    first_publish_date: work.first_publish_date,
    subjects: work.subjects,
    subject_places: work.subject_places,
    subject_people: work.subject_people,
    subject_times: work.subject_times,
    cover_url: firstCoverUrl(work.covers),
    excerpts: work.excerpts?.map(({ excerpt, comment }) =>
      withoutEmpty({ excerpt, comment }),
    ),
    links: work.links?.map(({ title, url }) => ({ title, url })),
  });
}

const handleGetWork: ToolHandler = async (args, clients) => {
  const { work_key: workKey } = parseArgs(GetWorkArgsSchema, args, "get_work");

  try {
    const lookup = await fetchWork(clients.api, toBareKey(workKey));

    if (!lookup.found) {
      return errorTextResult(`No work found for key: ${workKey}`);
    }

    const names = await fetchAuthorNames(clients.api, lookup.key);

    return jsonResult(toWorkDetails(lookup.key, lookup.work, names));
  } catch (error) {
    return toErrorResult(error, "get_work");
  }
};

export const getWorkTool: ToolDefinition = {
  name: "get_work",
  title: "Get work details",
  description:
    "Get the full record for an Open Library work — the book as a whole, across all its editions: description, subjects, authors, first publication date, cover and external links. Takes the `open_library_work_key` returned by `search_books`, `get_book_by_title` or `get_book_by_id`. Use `get_work_editions` to list the work's editions.",
  schema: GetWorkArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetWork,
};

export { handleGetWork };
