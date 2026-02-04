import {
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";

import { BookInfo, OpenLibrarySearchResponse } from "./types.js";

// Schema for the get_book_by_title tool arguments
export const GetBookByTitleArgsSchema = z.object({
  title: z.string().min(1, { message: "Title cannot be empty" }),
});

// Type for the Axios instance (can be imported or defined if needed elsewhere)
type AxiosInstance = ReturnType<typeof axios.create>;

const handleGetBookByTitle = async (
  args: unknown,
  axiosInstance: AxiosInstance,
): Promise<CallToolResult> => {
  const parseResult = GetBookByTitleArgsSchema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for get_book_by_title: ${errorMessages}`,
    );
  }

  const bookTitle = parseResult.data.title;

  try {
    const response = await axiosInstance.get<OpenLibrarySearchResponse>(
      "/search.json",
      {
        params: { title: bookTitle },
      },
    );

    if (
      !response.data ||
      !response.data.docs ||
      response.data.docs.length === 0
    ) {
      return {
        content: [
          {
            type: "text",
            text: `No books found matching title: "${bookTitle}"`,
          },
        ],
      };
    }

    const bookResults = Array.isArray(response.data.docs)
      ? response.data.docs.map((doc) => {
          const bookInfo: BookInfo = {
            title: doc.title,
            authors: doc.author_name || [],
            first_publish_year: doc.first_publish_year || null,
            open_library_work_key: doc.key,
            edition_count: doc.edition_count || 0,
          };

          if (doc.cover_i) {
            bookInfo.cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
          }

          return bookInfo;
        })
      : [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(bookResults, null, 2),
        },
      ],
    };
  } catch (error) {
    let errorMessage = "Failed to fetch book data from Open Library.";
    if (axios.isAxiosError(error)) {
      errorMessage = `Error processing request: ${
        error.response?.statusText ?? error.message
      }`;
    } else if (error instanceof Error) {
      errorMessage = `Error processing request: ${error.message}`;
    }
    console.error("Error in get_book_by_title:", error);

    return {
      content: [
        {
          type: "text",
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
};

export { handleGetBookByTitle };
