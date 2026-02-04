import {
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { z } from "zod";

import { AuthorInfo, OpenLibraryAuthorSearchResponse } from "./types.js";

// Schema for the get_authors_by-name tool arguments
export const GetAuthorsByNameArgsSchema = z.object({
  name: z.string().min(1, { message: "Author name cannot be empty" }),
});

// Type for the Axios instance
type AxiosInstance = ReturnType<typeof axios.create>;

const handleGetAuthorsByName = async (
  args: unknown,
  axiosInstance: AxiosInstance,
): Promise<CallToolResult> => {
  const parseResult = GetAuthorsByNameArgsSchema.safeParse(args);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for get_authors_by_name: ${errorMessages}`,
    );
  }

  const authorName = parseResult.data.name;

  try {
    const response = await axiosInstance.get<OpenLibraryAuthorSearchResponse>(
      "/search/authors.json", // Use the author search endpoint
      {
        params: { q: authorName }, // Use 'q' parameter for author search
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
            text: `No authors found matching name: "${authorName}"`,
          },
        ],
      };
    }

    const authorResults: AuthorInfo[] = response.data.docs.map((doc) => ({
      key: doc.key,
      name: doc.name,
      alternate_names: doc.alternate_names,
      birth_date: doc.birth_date,
      top_work: doc.top_work,
      work_count: doc.work_count,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(authorResults, null, 2),
        },
      ],
    };
  } catch (error) {
    let errorMessage = "Failed to fetch author data from Open Library.";
    if (axios.isAxiosError(error)) {
      errorMessage = `Open Library API error: ${
        error.response?.statusText ?? error.message
      }`;
    } else if (error instanceof Error) {
      errorMessage = `Error processing request: ${error.message}`;
    }
    console.error("Error in get_authors_by_name:", error);
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

export { handleGetAuthorsByName };
