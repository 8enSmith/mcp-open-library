import { describe, it, expect, vi, beforeEach } from "vitest";

import { InvalidArgumentsError } from "../../utils/errors.js";
import { OpenLibraryClients } from "../../utils/http.js";

import { handleGetAuthorPhoto } from "./index.js";

describe("handleGetAuthorPhoto", () => {
  let head: ReturnType<typeof vi.fn>;
  let clients: OpenLibraryClients;

  beforeEach(() => {
    head = vi.fn();
    clients = {
      api: { get: vi.fn() },
      covers: { head },
    } as unknown as OpenLibraryClients;
  });

  it("should return the photo URL when the photo exists", async () => {
    head.mockResolvedValue({ status: 200 });

    const result = await handleGetAuthorPhoto({ olid: "OL23919A" }, clients);

    expect(head).toHaveBeenCalledWith("/a/olid/OL23919A-L.jpg", {
      params: { default: false },
      validateStatus: expect.any(Function),
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "https://covers.openlibrary.org/a/olid/OL23919A-L.jpg",
        },
      ],
    });
  });

  it("should treat a redirect as the photo existing", async () => {
    head.mockResolvedValue({ status: 302 });

    const result = await handleGetAuthorPhoto({ olid: "OL23919A" }, clients);

    expect(result.content[0]).toEqual({
      type: "text",
      text: "https://covers.openlibrary.org/a/olid/OL23919A-L.jpg",
    });
  });

  it("should report when no photo is available", async () => {
    head.mockResolvedValue({ status: 404 });

    const result = await handleGetAuthorPhoto({ olid: "OL99999999A" }, clients);

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "No author photo available for OLID OL99999999A.",
        },
      ],
    });
  });

  it("should return an error result when the request fails", async () => {
    head.mockRejectedValue(new Error("socket hang up"));

    const result = await handleGetAuthorPhoto({ olid: "OL23919A" }, clients);

    expect(result).toEqual({
      content: [
        { type: "text", text: "Open Library API error: socket hang up" },
      ],
      isError: true,
    });
  });

  it("should reject for invalid OLID format", async () => {
    await expect(
      handleGetAuthorPhoto({ olid: "invalid-olid-format" }, clients),
    ).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_photo: olid: OLID must be in the format OL<number>A",
      ),
    );
  });

  it("should reject for empty OLID", async () => {
    await expect(handleGetAuthorPhoto({ olid: "" }, clients)).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_photo: olid: OLID cannot be empty, olid: OLID must be in the format OL<number>A",
      ),
    );
  });

  it("should reject if OLID is missing", async () => {
    await expect(handleGetAuthorPhoto({}, clients)).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_photo: olid: Invalid input: expected string, received undefined",
      ),
    );
  });

  it("should reject for non-object arguments", async () => {
    await expect(handleGetAuthorPhoto(null, clients)).rejects.toThrow(
      new InvalidArgumentsError(
        "Invalid arguments for get_author_photo: : Invalid input: expected object, received null",
      ),
    );
  });

  it("should not make a request when validation fails", async () => {
    await expect(handleGetAuthorPhoto({ olid: "" }, clients)).rejects.toThrow(
      InvalidArgumentsError,
    );
    expect(head).not.toHaveBeenCalled();
  });
});
