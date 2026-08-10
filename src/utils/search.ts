import { z } from "zod";

export const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "author_key",
  "first_publish_year",
  "edition_count",
  "cover_i",
  "ratings_average",
  "ebook_access",
].join(",");

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;
export const MAX_SEARCH_OFFSET = 1000;

export const searchLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_SEARCH_LIMIT)
  .default(DEFAULT_SEARCH_LIMIT)
  .describe(
    `Maximum number of results to return (1-${MAX_SEARCH_LIMIT}, default ${DEFAULT_SEARCH_LIMIT}).`,
  );

export const searchOffsetSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_SEARCH_OFFSET)
  .default(0)
  .describe(
    `Number of results to skip, for paging through the total reported as num_found (0-${MAX_SEARCH_OFFSET}, default 0).`,
  );

export interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  key: string;
  edition_count?: number;
  cover_i?: number;
  ratings_average?: number;
  ebook_access?: string;
}

export interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
  numFound?: number;
}

export interface BookInfo {
  title: string;
  authors: string[];
  author_keys?: string[];
  first_publish_year: number | null;
  open_library_work_key: string;
  edition_count: number;
  cover_url?: string;
  ratings_average?: number;
  ebook_access?: string;
}

export interface SearchResults {
  num_found: number;
  offset: number;
  limit: number;
  results: BookInfo[];
}

export function toBookInfo(doc: OpenLibraryDoc): BookInfo {
  const bookInfo: BookInfo = {
    title: doc.title,
    authors: doc.author_name || [],
    first_publish_year: doc.first_publish_year || null,
    open_library_work_key: doc.key,
    edition_count: doc.edition_count || 0,
  };

  if (doc.author_key?.length) {
    bookInfo.author_keys = doc.author_key;
  }

  if (doc.cover_i) {
    bookInfo.cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  }

  if (typeof doc.ratings_average === "number") {
    bookInfo.ratings_average = Math.round(doc.ratings_average * 100) / 100;
  }

  if (doc.ebook_access) {
    bookInfo.ebook_access = doc.ebook_access;
  }

  return bookInfo;
}

export function toSearchResults(
  response: OpenLibrarySearchResponse,
  limit: number,
  offset: number,
): SearchResults {
  const docs = Array.isArray(response.docs) ? response.docs : [];

  return {
    num_found: response.numFound ?? docs.length,
    offset,
    limit,
    results: docs.map(toBookInfo),
  };
}
