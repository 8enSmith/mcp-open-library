import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AxiosInstance } from "axios";

import { toErrorResult } from "./errors.js";
import { COVERS_BASE_URL } from "./http.js";
import { textResult } from "./results.js";

/**
 * `?default=false` makes the covers service answer 404 instead of serving a
 * blank placeholder image. A cover that does exist may answer 200 or 302
 * (author photos redirect), so anything other than a 404 counts as present.
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
    const response = await covers.head(path, {
      params: { default: false },
      validateStatus: () => true,
    });

    if (response.status === 404) {
      return textResult(missingMessage);
    }

    return textResult(`${COVERS_BASE_URL}${path}`);
  } catch (error) {
    return toErrorResult(error, toolName);
  }
}
