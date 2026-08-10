import { describe, expect, it, vi, beforeEach } from "vitest";

import { axiosErrorWithStatus } from "../../test-support/axios-error.js";
import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import { handleGetBookCover } from "./index.js";

function coverText(result: Awaited<ReturnType<typeof handleGetBookCover>>) {
  return (result.content[0] as { type: "text"; text: string }).text;
}

describe("handleGetBookCover", () => {
  let head: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    head = vi.fn().mockResolvedValue({ status: 200 });
    clients = {
      api: { get: vi.fn() },
      covers: { head },
    } as unknown as OpenLibraryClients;
  });

  it("should generate correct URL with ISBN", async () => {
    const result = await handleGetBookCover(
      { key: "ISBN", value: "0451526538" },
      clients,
    );

    expect(head).toHaveBeenCalledWith("/b/isbn/0451526538-L.jpg", {
      params: { default: false },
    });
    expect(coverText(result)).toBe(
      "https://covers.openlibrary.org/b/isbn/0451526538-L.jpg",
    );
  });

  it("should generate correct URL with OLID", async () => {
    const result = await handleGetBookCover(
      { key: "OLID", value: "OL7353617M" },
      clients,
    );
    expect(coverText(result)).toBe(
      "https://covers.openlibrary.org/b/olid/OL7353617M-L.jpg",
    );
  });

  it("should handle different size parameters", async () => {
    for (const size of ["S", "M", "L"] as const) {
      const result = await handleGetBookCover(
        { key: "ISBN", value: "0451526538", size },
        clients,
      );
      expect(coverText(result)).toBe(
        `https://covers.openlibrary.org/b/isbn/0451526538-${size}.jpg`,
      );
    }
  });

  it("should default to large size when size is omitted", async () => {
    const result = await handleGetBookCover(
      { key: "ISBN", value: "0451526538" },
      clients,
    );
    expect(coverText(result)).toBe(
      "https://covers.openlibrary.org/b/isbn/0451526538-L.jpg",
    );
  });

  it("should report when no cover is available", async () => {
    head.mockRejectedValue(axiosErrorWithStatus(404, "Not Found"));

    const result = await handleGetBookCover(
      { key: "OLID", value: "OL00000000M" },
      clients,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "No cover image available for OLID OL00000000M.",
        },
      ],
    });
  });

  // Only a 404 means "no such cover". Any other failing status is an upstream
  // problem, and reporting a URL for it would claim the image exists.
  it("should return an error result for a failing status other than 404", async () => {
    head.mockRejectedValue(axiosErrorWithStatus(500, "Internal Server Error"));

    const result = await handleGetBookCover(
      { key: "ISBN", value: "0451526538" },
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

  it("should return an error result when the request fails", async () => {
    head.mockRejectedValue(new Error("timeout of 15000ms exceeded"));

    const result = await handleGetBookCover(
      { key: "ISBN", value: "0451526538" },
      clients,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Open Library API error: timeout of 15000ms exceeded",
        },
      ],
      isError: true,
    });
  });

  it("should throw error for invalid key", async () => {
    await expect(
      handleGetBookCover({ key: "INVALID_KEY", value: "0451526538" }, clients),
    ).rejects.toThrow(InvalidArgumentsError);

    try {
      await handleGetBookCover(
        { key: "INVALID_KEY", value: "0451526538" },
        clients,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentsError);
      expect((error as Error).message).toContain(
        "Invalid arguments for get_book_cover",
      );
    }
  });

  it("should throw error for empty value", async () => {
    try {
      await handleGetBookCover({ key: "ISBN", value: "" }, clients);
      expect.unreachable("expected handleGetBookCover to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentsError);
      expect((error as Error).message).toContain("Value cannot be empty");
    }
  });

  it("should throw error for invalid size", async () => {
    await expect(
      handleGetBookCover(
        { key: "ISBN", value: "0451526538", size: "XL" },
        clients,
      ),
    ).rejects.toThrow(InvalidArgumentsError);
  });

  it("should reject an explicit null size", async () => {
    await expect(
      handleGetBookCover(
        { key: "ISBN", value: "0451526538", size: null },
        clients,
      ),
    ).rejects.toThrow(InvalidArgumentsError);
  });

  it("should throw error for missing required parameters", async () => {
    await expect(handleGetBookCover({}, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );
    await expect(handleGetBookCover({ key: "ISBN" }, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );
    await expect(
      handleGetBookCover({ value: "0451526538" }, clients),
    ).rejects.toThrow(InvalidArgumentsError);
  });
});
