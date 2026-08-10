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
  // ISBNs come from this nested sub-query, which returns one edition per work
  // along with that edition's own identifiers. Do NOT reach for the top-level
  // `isbn` field instead: it returns every edition's ISBN (6,113 of them for
  // Pride and Prejudice), inflating a 10-result page from ~2.7KB to ~97KB, and
  // the resulting list is incoherent — unrelated printings in different
  // languages, none of which is "the" ISBN.
  "editions",
  "editions.key",
  "editions.isbn",
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

export interface OpenLibraryEditionDoc {
  key?: string;
  isbn?: string[];
}

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
  editions?: {
    numFound?: number;
    docs?: OpenLibraryEditionDoc[];
  };
}

export interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
  numFound?: number;
}

/**
 * One specific edition of the work — the one Open Library ranked best for the
 * query. Its `edition_key` is an OLID that can be passed straight to
 * `get_book_by_id` as `{ idType: "olid" }` for the full edition record.
 */
export interface BestEdition {
  edition_key?: string;
  isbn_13?: string;
  isbn_10?: string;
}

export interface BookInfo {
  title: string;
  authors: string[];
  author_keys?: string[];
  first_publish_year: number | null;
  open_library_work_key: string;
  edition_count: number;
  best_edition?: BestEdition;
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

const ISBN_13_LENGTH = 13;
const ISBN_10_LENGTH = 10;

/**
 * Open Library's `isbn` values are not consistently formatted — the same field
 * yields `9780425038912`, `978-84-667-4056-8` and `9 780198 319207`. Stripping
 * the separators is what makes the length test trustworthy (a hyphenated
 * ISBN-10 is also 13 characters) and yields a value usable as an identifier.
 */
function normaliseIsbn(value: string): string {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

/**
 * `isbn` mixes ISBN-13 and ISBN-10 for the edition, so they are split by
 * length. Where an edition lists more than one of a kind the first is taken —
 * rare, and `get_book_by_id` returns the complete arrays for that edition.
 */
function toBestEdition(
  edition: OpenLibraryEditionDoc | undefined,
): BestEdition | undefined {
  if (!edition) {
    return undefined;
  }

  const bestEdition: BestEdition = {};

  if (edition.key) {
    // "/books/OL7500941M" -> "OL7500941M", so it can be passed to
    // get_book_by_id as an olid without further handling.
    bestEdition.edition_key = edition.key.replace(/^\/books\//, "");
  }

  for (const raw of edition.isbn ?? []) {
    const isbn = normaliseIsbn(raw);

    if (isbn.length === ISBN_13_LENGTH && !bestEdition.isbn_13) {
      bestEdition.isbn_13 = isbn;
    } else if (isbn.length === ISBN_10_LENGTH && !bestEdition.isbn_10) {
      bestEdition.isbn_10 = isbn;
    }
  }

  return Object.keys(bestEdition).length > 0 ? bestEdition : undefined;
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

  const bestEdition = toBestEdition(doc.editions?.docs?.[0]);
  if (bestEdition) {
    bookInfo.best_edition = bestEdition;
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
