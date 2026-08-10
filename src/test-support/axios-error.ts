import { AxiosError, AxiosHeaders } from "axios";

/**
 * Builds the error axios rejects with for a non-2xx response. The shape matters
 * to `isNotFound` and `describeError`, so every test that simulates an upstream
 * failure uses this rather than a hand-rolled object.
 */
export function axiosErrorWithStatus(status: number, statusText?: string) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: statusText ?? "",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    },
  );
}
