import { AxiosError, AxiosHeaders } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import { handleGetAuthorInfo } from "./index.js";

function axiosErrorWithStatus(status: number, statusText: string) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText,
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    },
  );
}

describe("handleGetAuthorInfo", () => {
  let get: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    get = vi.fn();
    clients = {
      api: { get },
      covers: { head: vi.fn() },
    } as unknown as OpenLibraryClients;
  });

  it("should return author info for a valid author key", async () => {
    const mockAuthorData = {
      name: "J.R.R. Tolkien",
      key: "/authors/OL26320A",
      birth_date: "3 January 1892",
      death_date: "2 September 1973",
      bio: "British writer, poet, philologist, and academic.",
    };
    get.mockResolvedValue({ data: mockAuthorData });

    const result = await handleGetAuthorInfo(
      { author_key: "OL26320A" },
      clients,
    );

    expect(get).toHaveBeenCalledWith("/authors/OL26320A.json");
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify(mockAuthorData, null, 2) },
    ]);
  });

  it("should handle bio as an object", async () => {
    get.mockResolvedValue({
      data: {
        name: "George Orwell",
        key: "/authors/OL27346A",
        bio: {
          type: "/type/text",
          value: "English novelist, essayist, journalist and critic.",
        },
      },
    });

    const result = await handleGetAuthorInfo(
      { author_key: "OL27346A" },
      clients,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          {
            name: "George Orwell",
            key: "/authors/OL27346A",
            bio: "English novelist, essayist, journalist and critic.",
          },
          null,
          2,
        ),
      },
    ]);
  });

  it("should reject for invalid author key format", async () => {
    await expect(
      handleGetAuthorInfo({ author_key: "invalid-key" }, clients),
    ).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_info: author_key: Author key must be in the format OL<number>A",
      ),
    );
  });

  it("should reject for empty author key", async () => {
    await expect(
      handleGetAuthorInfo({ author_key: "" }, clients),
    ).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_info: author_key: Author key cannot be empty, author_key: Author key must be in the format OL<number>A",
      ),
    );
  });

  it("should return an error message for a 404 Not Found response", async () => {
    get.mockRejectedValue(axiosErrorWithStatus(404, "Not Found"));

    const result = await handleGetAuthorInfo(
      { author_key: "OL00000A" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: 'Author with key "OL00000A" not found.' },
    ]);
  });

  it("should report the status for other Axios errors", async () => {
    get.mockRejectedValue(axiosErrorWithStatus(500, "Internal Server Error"));

    const result = await handleGetAuthorInfo(
      { author_key: "OL12345A" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Open Library API error: 500 Internal Server Error",
      },
    ]);
  });

  it("should return a generic error message for non-Axios errors", async () => {
    get.mockRejectedValue(new Error("Network Error"));

    const result = await handleGetAuthorInfo(
      { author_key: "OL98765A" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Open Library API error: Network Error" },
    ]);
  });

  it("should return a message if API returns 200 but no data", async () => {
    get.mockResolvedValue({ data: null });

    const result = await handleGetAuthorInfo(
      { author_key: "OL11111A" },
      clients,
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: 'No data found for author key: "OL11111A"' },
    ]);
  });
});
