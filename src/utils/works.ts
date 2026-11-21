import { AxiosInstance } from "axios";
import { z } from "zod";

import { isNotFound } from "./errors.js";
import { COVERS_BASE_URL } from "./http.js";

export const workKeySchema = z
  .string()
  .regex(/^(?:\/works\/)?OL\d+W$/, {
    message:
      "work_key must be an Open Library work key, e.g. OL45804W or /works/OL45804W",
  })
  .describe(
    "The Open Library work key, e.g. OL45804W. The /works/OL45804W form returned by search_books, get_book_by_title and get_book_by_id is also accepted.",
  );

export interface OpenLibraryWorkRecord {
  key: string;
  type: { key: string };
  location?: string;
  title?: string;
  subtitle?: string;
  authors?: { author?: { key?: string } }[];
  description?: string | { type: string; value: string };
  first_publish_date?: string;
  subjects?: string[];
  subject_places?: string[];
  subject_people?: string[];
  subject_times?: string[];
  covers?: number[];
  excerpts?: { excerpt: string; comment?: string; author?: { key: string } }[];
  links?: { title: string; url: string; type?: { key: string } }[];
}

export type WorkLookup =
  { found: true; key: string; work: OpenLibraryWorkRecord } | { found: false };

const WORK_TYPE = "/type/work";
const REDIRECT_TYPE = "/type/redirect";
const WORK_PATH = /^\/works\/OL\d+W$/;
const NOT_FOUND: WorkLookup = { found: false };

export function toBareKey(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

export function firstCoverUrl(
  covers: number[] | undefined,
): string | undefined {
  const id = covers?.find((cover) => cover > 0);
  return id === undefined ? undefined : `${COVERS_BASE_URL}/b/id/${id}-M.jpg`;
}

async function getWorkRecord(
  api: AxiosInstance,
  workKey: string,
): Promise<OpenLibraryWorkRecord | undefined> {
  try {
    const response = await api.get<OpenLibraryWorkRecord>(
      `/works/${workKey}.json`,
    );
    return response.data;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

const asFound = (
  record: OpenLibraryWorkRecord | undefined,
  key: string,
): WorkLookup =>
  record?.type?.key === WORK_TYPE
    ? { found: true, key, work: record }
    : NOT_FOUND;

export async function fetchWork(
  api: AxiosInstance,
  workKey: string,
): Promise<WorkLookup> {
  const record = await getWorkRecord(api, workKey);

  if (record?.type?.key !== REDIRECT_TYPE) {
    return asFound(record, workKey);
  }

  if (!record.location || !WORK_PATH.test(record.location)) {
    return NOT_FOUND;
  }

  const canonicalKey = toBareKey(record.location);
  return asFound(await getWorkRecord(api, canonicalKey), canonicalKey);
}
