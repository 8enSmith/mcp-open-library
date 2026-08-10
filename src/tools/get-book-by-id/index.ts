import { z } from "zod";

import { isNotFound, parseArgs, toErrorResult } from "../../utils/errors.js";
import { errorTextResult, jsonResult } from "../../utils/results.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

import {
  BookDetails,
  OpenLibraryBookResponse,
  OpenLibraryRecord,
} from "./types.js";

export const GetBookByIdArgsSchema = z.object({
  idType: z
    .enum(["isbn", "lccn", "oclc", "olid"], {
      message: "idType must be one of: isbn, lccn, oclc, olid",
    })
    .describe(
      "The type of identifier used (isbn, lccn, oclc, olid). Case-insensitive.",
    ),
  idValue: z
    .string()
    .min(1, { message: "idValue cannot be empty" })
    .describe("The value of the identifier."),
});

// Normalised before validation rather than inside the schema: a zod transform
// would erase the enum from the generated JSON Schema, hiding the accepted
// values from clients.
function normaliseIdType(args: unknown): unknown {
  if (args && typeof args === "object" && "idType" in args) {
    const { idType } = args as { idType: unknown };
    if (typeof idType === "string") {
      return { ...args, idType: idType.toLowerCase() };
    }
  }
  return args;
}

const handleGetBookById: ToolHandler = async (args, clients) => {
  const { idType, idValue } = parseArgs(
    GetBookByIdArgsSchema,
    normaliseIdType(args),
    "get_book_by_id",
  );

  const apiUrl = `/api/volumes/brief/${idType}/${idValue}.json`;

  try {
    const response = await clients.api.get<OpenLibraryBookResponse>(apiUrl);

    if (
      !response.data ||
      !response.data.records ||
      Object.keys(response.data.records).length === 0
    ) {
      return errorTextResult(`No book found for ${idType}: ${idValue}`);
    }

    const recordKey = Object.keys(response.data.records)[0];
    const record: OpenLibraryRecord | undefined =
      response.data.records[recordKey];

    if (!record) {
      return errorTextResult(
        `Could not process book record for ${idType}: ${idValue}`,
      );
    }

    const recordData = record.data;
    const recordDetails = record.details?.details;

    const bookDetails: BookDetails = {
      title: recordData.title,
      subtitle: recordData.subtitle,
      authors: recordData.authors?.map((a) => a.name) || [],
      publishers: recordData.publishers?.map((p) => p.name),
      publish_date: recordData.publish_date,
      number_of_pages:
        recordData.number_of_pages ?? recordDetails?.number_of_pages,
      // Prefer identifiers from recordData, fallback to recordDetails if necessary
      isbn_13: recordData.identifiers?.isbn_13 ?? recordDetails?.isbn_13,
      isbn_10: recordData.identifiers?.isbn_10 ?? recordDetails?.isbn_10,
      lccn: recordData.identifiers?.lccn ?? recordDetails?.lccn,
      oclc: recordData.identifiers?.oclc ?? recordDetails?.oclc_numbers,
      olid: recordData.identifiers?.openlibrary,
      open_library_edition_key: recordData.key,
      open_library_work_key: recordDetails?.works?.[0]?.key,
      cover_url: recordData.cover?.medium,
      info_url: record.details?.info_url ?? recordData.url,
      preview_url:
        record.details?.preview_url ?? recordData.ebooks?.[0]?.preview_url,
    };

    // Clean up undefined fields
    Object.keys(bookDetails).forEach((key) => {
      const typedKey = key as keyof BookDetails;
      if (
        bookDetails[typedKey] === undefined ||
        ((typedKey === "authors" || typedKey === "publishers") &&
          Array.isArray(bookDetails[typedKey]) &&
          bookDetails[typedKey].length === 0)
      ) {
        delete bookDetails[typedKey];
      }
    });

    return jsonResult(bookDetails);
  } catch (error) {
    if (isNotFound(error)) {
      return errorTextResult(`No book found for ${idType}: ${idValue}`);
    }
    return toErrorResult(error, "get_book_by_id");
  }
};

export const getBookByIdTool: ToolDefinition = {
  name: "get_book_by_id",
  title: "Get book by identifier",
  description:
    "Get detailed information about a book using its identifier (ISBN, LCCN, OCLC, OLID).",
  schema: GetBookByIdArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetBookById,
};

export { handleGetBookById };
