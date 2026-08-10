import { z } from "zod";

import { resolveCoverUrl } from "../../utils/covers.js";
import { parseArgs } from "../../utils/errors.js";
import { READ_ONLY_LOOKUP, ToolDefinition, ToolHandler } from "../types.js";

export const GetAuthorPhotoArgsSchema = z.object({
  olid: z
    .string()
    .min(1, { message: "OLID cannot be empty" })
    .regex(/^OL\d+A$/, {
      message: "OLID must be in the format OL<number>A",
    })
    .describe(
      "The Open Library Author ID (OLID) for the author (e.g. OL23919A).",
    ),
});

const handleGetAuthorPhoto: ToolHandler = async (args, clients) => {
  const { olid } = parseArgs(
    GetAuthorPhotoArgsSchema,
    args,
    "get_author_photo",
  );

  return resolveCoverUrl(
    clients.covers,
    `/a/olid/${olid}-L.jpg`,
    `No author photo available for OLID ${olid}.`,
    "get_author_photo",
  );
};

export const getAuthorPhotoTool: ToolDefinition = {
  name: "get_author_photo",
  title: "Get author photo URL",
  description:
    "Get the URL for an author's photo using their Open Library Author ID (OLID e.g. OL23919A). Reports when no photo exists rather than returning a URL to a blank placeholder.",
  schema: GetAuthorPhotoArgsSchema,
  annotations: READ_ONLY_LOOKUP,
  handler: handleGetAuthorPhoto,
};

export { handleGetAuthorPhoto };
