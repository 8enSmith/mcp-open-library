import axios, { AxiosInstance } from "axios";

export const REQUEST_TIMEOUT_MS = 15_000;

export const API_BASE_URL = "https://openlibrary.org";
export const COVERS_BASE_URL = "https://covers.openlibrary.org";

export interface OpenLibraryClients {
  api: AxiosInstance;
  covers: AxiosInstance;
}

/**
 * Open Library throttles unidentified clients to 1 request/second; clients
 * sending a User-Agent naming the application get 3/second.
 */
export function createHttpClient(
  baseURL: string,
  version: string,
): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent": `mcp-open-library/${version} (+https://github.com/8enSmith/mcp-open-library)`,
    },
  });
}

export function createOpenLibraryClients(version: string): OpenLibraryClients {
  return {
    api: createHttpClient(API_BASE_URL, version),
    covers: createHttpClient(COVERS_BASE_URL, version),
  };
}
