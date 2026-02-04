import {
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";

import {
  BookDetails,
  OpenLibraryBookResponse,
  OpenLibraryRecord, // Import the updated record type
} from "./types.js";

// Schema for the get_book_by_id tool arguments
const GetBookByIdArgsSchema = z.object({
  idType: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(
      z.enum(["isbn", "lccn", "oclc", "olid"], {
        message: "idType must be one of: isbn, lccn, oclc, olid",
      }),
    ),
  idValue: z.string().min(1, { message: "idValue cannot be empty" }),
});

// Type for the Axios instance
type AxiosInstance = ReturnType<typeof axios.create>;

export const handleGetBookById = async (
  args: unknown,
  axiosInstance: AxiosInstance,
): Promise<CallToolResult> => {
  const parseResult = GetBookByIdArgsSchema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for get_book_by_id: ${errorMessages}`,
    );
  }

  const { idType, idValue } = parseResult.data;
  const apiUrl = `/api/volumes/brief/${idType}/${idValue}.json`;

  try {
    const response = await axiosInstance.get<OpenLibraryBookResponse>(apiUrl);

    // Check if records object exists and is not empty
    if (
      !response.data ||
      !response.data.records ||
      Object.keys(response.data.records).length === 0
    ) {
      return {
        content: [
          {
            type: "text",
            text: `No book found for ${idType}: ${idValue}`,
          },
        ],
      };
    }

    // Get the first record from the records object
    const recordKey = Object.keys(response.data.records)[0];
    const record: OpenLibraryRecord | undefined =
      response.data.records[recordKey];

    if (!record) {
      // This case should theoretically not happen if the length check passed, but good for safety
      return {
        content: [
          {
            type: "text",
            text: `Could not process book record for ${idType}: ${idValue}`,
          },
        ],
      };
    }

    const recordData = record.data;
    const recordDetails = record.details?.details; // Access the nested details

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
      olid: recordData.identifiers?.openlibrary, // Add OLID from identifiers
      open_library_edition_key: recordData.key, // From recordData
      open_library_work_key: recordDetails?.works?.[0]?.key, // From nested details
      cover_url: recordData.cover?.medium, // Use medium cover from recordData
      info_url: record.details?.info_url ?? recordData.url, // Prefer info_url from details
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

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(bookDetails, null, 2),
        },
      ],
    };
  } catch (error) {
    let errorMessage = "Failed to fetch book data from Open Library.";
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        errorMessage = `No book found for ${idType}: ${idValue}`;
      } else {
        errorMessage = `API Error: ${error.response?.statusText ?? error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = `Error processing request: ${error.message}`;
    }
    console.error("Error in get_book_by_id:", error);

    // Return error as text content
    return {
      content: [
        {
          type: "text",
          text: errorMessage,
        },
      ],
    };
  }
};
