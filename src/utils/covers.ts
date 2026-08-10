import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AxiosInstance } from "axios";

import { isNotFound, toErrorResult } from "./errors.js";
import { COVERS_BASE_URL } from "./http.js";
import { textResult } from "./results.js";

/**
 * `?default=false` makes the covers service answer 404 instead of serving a
 * blank placeholder image, so a 404 is the "no image" answer rather than a
 * failure. An image that does exist answers 302 at the origin and resolves to
 * 200 once axios follows the redirect to the Internet Archive.
 *
 * Every other status — a 429, a 500, an archive.org hiccup — has to surface as
 * an error. Reporting a URL for those would tell the caller an image exists on
 * the strength of a request that never succeeded.
 *
 * The URL handed back omits `default=false` so that it stays embeddable.
 */
export async function resolveCoverUrl(
  covers: AxiosInstance,
  path: string,
  missingMessage: string,
  toolName: string,
): Promise<CallToolResult> {
  try {
    await covers.head(path, { params: { default: false } });

    return textResult(`${COVERS_BASE_URL}${path}`);
  } catch (error) {
    if (isNotFound(error)) {
      return textResult(missingMessage);
    }
    return toErrorResult(error, toolName);
  }
}
