import { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";

import { axiosErrorWithStatus } from "../test-support/axios-error.js";

import { resolveCoverUrl } from "./covers.js";

function coversClient(head: ReturnType<typeof vi.fn>) {
  return { head } as unknown as AxiosInstance;
}

const PATH = "/b/id/12345-M.jpg";

describe("resolveCoverUrl", () => {
  it("returns the embeddable URL when the image exists", async () => {
    const head = vi.fn().mockResolvedValue({ status: 200 });

    const result = await resolveCoverUrl(
      coversClient(head),
      PATH,
      "missing",
      "get_book_cover",
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "https://covers.openlibrary.org/b/id/12345-M.jpg",
        },
      ],
    });
  });

  // Leaving axios to reject on error statuses is what makes the 5xx case below
  // reachable. `validateStatus: () => true` would resolve every status, so a 500
  // would fall through and be reported as an existing image.
  it("does not suppress error statuses on the request", async () => {
    const head = vi.fn().mockResolvedValue({ status: 200 });

    await resolveCoverUrl(
      coversClient(head),
      PATH,
      "missing",
      "get_book_cover",
    );

    expect(head).toHaveBeenCalledWith(PATH, { params: { default: false } });
    const [, config] = head.mock.calls[0] as [string, object];
    expect(config).not.toHaveProperty("validateStatus");
  });

  // `default=false` turns the blank placeholder into a real 404, so a 404 is the
  // "no image" answer rather than a failure — hence no isError.
  it("reports a 404 as no image available, without isError", async () => {
    const head = vi.fn().mockRejectedValue(axiosErrorWithStatus(404));

    const result = await resolveCoverUrl(
      coversClient(head),
      PATH,
      "No cover image available for ID 12345.",
      "get_book_cover",
    );

    expect(result).toEqual({
      content: [
        { type: "text", text: "No cover image available for ID 12345." },
      ],
    });
  });

  it.each([
    [401, "Unauthorized"],
    [429, "Too Many Requests"],
    [500, "Internal Server Error"],
  ])(
    "reports %i as an error rather than an existing image",
    async (status, statusText) => {
      const head = vi
        .fn()
        .mockRejectedValue(axiosErrorWithStatus(status, statusText));

      const result = await resolveCoverUrl(
        coversClient(head),
        PATH,
        "missing",
        "get_book_cover",
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Open Library API error: ${status} ${statusText}`,
          },
        ],
        isError: true,
      });
    },
  );
});
