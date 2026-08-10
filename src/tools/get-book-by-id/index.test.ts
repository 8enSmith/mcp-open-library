/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError, AxiosHeaders } from "axios";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import { OpenLibraryBookResponse } from "./types.js";

import { handleGetBookById } from "./index.js";

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

describe("handleGetBookById", () => {
  let get: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    get = vi.fn();
    clients = {
      api: { get },
      covers: { head: vi.fn() },
    } as unknown as OpenLibraryClients;
  });

  it("should return book details when given a valid OLID", async () => {
    const mockApiResponse: OpenLibraryBookResponse = {
      records: {
        "/books/OL7353617M": {
          recordURL:
            "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
          data: {
            title: "The Lord of the Rings",
            authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
            publish_date: "1954",
            identifiers: {
              openlibrary: ["OL7353617M"],
              isbn_10: ["061826027X"],
            },
            number_of_pages: 1216,
            cover: {
              medium: "https://covers.openlibrary.org/b/id/8264411-M.jpg",
            },
            key: "/books/OL7353617M",
            url: "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
          },
          details: {
            info_url:
              "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
            bib_key: "OLID:OL7353617M",
            preview_url: "https://archive.org/details/lordofrings00tolk_1",
            thumbnail_url: "https://covers.openlibrary.org/b/id/8264411-S.jpg",
            details: {
              key: "/books/OL7353617M",
              works: [{ key: "/works/OL45804W" }],
              title: "The Lord of the Rings",
              authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
              publishers: [{ name: "Houghton Mifflin" }],
              publish_date: "1954",
              isbn_10: ["061826027X"],
              number_of_pages: 1216,
            },
            preview: "restricted",
          },
        },
      },
      items: [],
    };

    get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetBookById(
      { idType: "olid", idValue: "OL7353617M" },
      clients,
    );

    expect(get).toHaveBeenCalledWith("/api/volumes/brief/olid/OL7353617M.json");

    const parsedResult = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsedResult).toHaveProperty("title", "The Lord of the Rings");
    expect(parsedResult).toHaveProperty("authors", ["J.R.R. Tolkien"]);
    expect(parsedResult).toHaveProperty("publish_date", "1954");
    expect(parsedResult).toHaveProperty("number_of_pages", 1216);
    expect(parsedResult).toHaveProperty("isbn_10", ["061826027X"]);
    expect(parsedResult).toHaveProperty("olid", ["OL7353617M"]);
    expect(parsedResult).toHaveProperty(
      "open_library_edition_key",
      "/books/OL7353617M",
    );
    expect(parsedResult).toHaveProperty(
      "open_library_work_key",
      "/works/OL45804W",
    );
    expect(parsedResult).toHaveProperty(
      "cover_url",
      "https://covers.openlibrary.org/b/id/8264411-M.jpg",
    );
    expect(parsedResult).toHaveProperty(
      "info_url",
      "https://openlibrary.org/books/OL7353617M/The_Lord_of_the_Rings",
    );
    expect(parsedResult).toHaveProperty(
      "preview_url",
      "https://archive.org/details/lordofrings00tolk_1",
    );
  });

  it("should return book details when given a valid ISBN", async () => {
    const mockApiResponse: OpenLibraryBookResponse = {
      records: {
        "isbn:9780547928227": {
          recordURL: "https://openlibrary.org/books/OL25189068M/The_Hobbit",
          data: {
            title: "The Hobbit",
            authors: [{ url: "/authors/OL216228A", name: "J.R.R. Tolkien" }],
            publish_date: "2012",
            identifiers: {
              isbn_13: ["9780547928227"],
              openlibrary: ["OL25189068M"],
            },
            key: "/books/OL25189068M",
            url: "https://openlibrary.org/books/OL25189068M/The_Hobbit",
          },
          details: {} as any,
        },
      },
      items: [],
    };
    get.mockResolvedValue({ data: mockApiResponse });

    const result = await handleGetBookById(
      { idType: "isbn", idValue: "9780547928227" },
      clients,
    );

    expect(get).toHaveBeenCalledWith(
      "/api/volumes/brief/isbn/9780547928227.json",
    );
    const parsedResult = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsedResult).toHaveProperty("title", "The Hobbit");
    expect(parsedResult).toHaveProperty("isbn_13", ["9780547928227"]);
    expect(parsedResult).toHaveProperty("olid", ["OL25189068M"]);
  });

  it("should accept an uppercase idType", async () => {
    get.mockResolvedValue({ data: { records: {}, items: [] } });

    await handleGetBookById({ idType: "ISBN", idValue: "123" }, clients);

    expect(get).toHaveBeenCalledWith("/api/volumes/brief/isbn/123.json");
  });

  it("should reject for invalid arguments", async () => {
    const invalidArgs = { idType: "invalid", idValue: "123" };

    await expect(handleGetBookById(invalidArgs, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );

    try {
      await handleGetBookById(invalidArgs, clients);
      expect.unreachable("expected handleGetBookById to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentsError);
      expect((error as Error).message).toContain(
        "Invalid arguments for get_book_by_id",
      );
      expect((error as Error).message).toContain(
        "idType must be one of: isbn, lccn, oclc, olid",
      );
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('should return "No book found" message when API returns empty records', async () => {
    get.mockResolvedValue({ data: { records: {}, items: [] } });

    const result = await handleGetBookById(
      { idType: "olid", idValue: "OL_NONEXISTENT" },
      clients,
    );

    expect(result).toEqual({
      content: [
        { type: "text", text: "No book found for olid: OL_NONEXISTENT" },
      ],
    });
  });

  it('should return "No book found" message on 404 API error', async () => {
    get.mockRejectedValue(axiosErrorWithStatus(404, "Not Found"));

    const result = await handleGetBookById(
      { idType: "isbn", idValue: "0000000000" },
      clients,
    );

    expect(result).toEqual({
      content: [{ type: "text", text: "No book found for isbn: 0000000000" }],
      isError: true,
    });
  });

  it("should report the status for non-404 API errors", async () => {
    get.mockRejectedValue(axiosErrorWithStatus(500, "Internal Server Error"));

    const result = await handleGetBookById(
      { idType: "olid", idValue: "OL1M" },
      clients,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Open Library API error: 500 Internal Server Error",
        },
      ],
      isError: true,
    });
  });

  it("should return a generic error message for non-Axios errors", async () => {
    get.mockRejectedValue(new Error("Network Failure"));

    const result = await handleGetBookById(
      { idType: "olid", idValue: "OL1M" },
      clients,
    );

    expect(result).toEqual({
      content: [
        { type: "text", text: "Open Library API error: Network Failure" },
      ],
      isError: true,
    });
  });
});
