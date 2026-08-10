import { describe, expect, it } from "vitest";

import {
  API_BASE_URL,
  COVERS_BASE_URL,
  createHttpClient,
  createOpenLibraryClients,
  REQUEST_TIMEOUT_MS,
} from "./http.js";

describe("createHttpClient", () => {
  it("identifies the client so Open Library applies the higher rate limit", () => {
    const client = createHttpClient(API_BASE_URL, "9.9.9");

    expect(client.defaults.headers["User-Agent"]).toBe(
      "mcp-open-library/9.9.9 (+https://github.com/8enSmith/mcp-open-library)",
    );
  });

  it("sets a request timeout so a stalled upstream cannot hang the client", () => {
    const client = createHttpClient(API_BASE_URL, "9.9.9");

    expect(client.defaults.timeout).toBe(REQUEST_TIMEOUT_MS);
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("applies the given base URL", () => {
    expect(createHttpClient(API_BASE_URL, "1.0.0").defaults.baseURL).toBe(
      "https://openlibrary.org",
    );
  });
});

describe("createOpenLibraryClients", () => {
  it("creates separately based clients for the API and the covers service", () => {
    const clients = createOpenLibraryClients("1.2.3");

    expect(clients.api.defaults.baseURL).toBe(API_BASE_URL);
    expect(clients.covers.defaults.baseURL).toBe(COVERS_BASE_URL);
    expect(clients.covers.defaults.headers["User-Agent"]).toBe(
      "mcp-open-library/1.2.3 (+https://github.com/8enSmith/mcp-open-library)",
    );
  });
});
