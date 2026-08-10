import { getAuthorInfoTool } from "./get-author-info/index.js";
import { getAuthorPhotoTool } from "./get-author-photo/index.js";
import { getAuthorsByNameTool } from "./get-authors-by-name/index.js";
import { getBookByIdTool } from "./get-book-by-id/index.js";
import { getBookByTitleTool } from "./get-book-by-title/index.js";
import { getBookCoverTool } from "./get-book-cover/index.js";
import { searchBooksTool } from "./search-books/index.js";
import { ToolDefinition } from "./types.js";

export const TOOLS: ToolDefinition[] = [
  searchBooksTool,
  getBookByTitleTool,
  getBookByIdTool,
  getAuthorsByNameTool,
  getAuthorInfoTool,
  getAuthorPhotoTool,
  getBookCoverTool,
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));
