import { describe, expect, it } from "vitest";

import { axiosErrorWithStatus } from "../../test-support/axios-error.js";
import { fakeClients, jsonBody } from "../../test-support/fake-clients.js";
import { InvalidArgumentsError } from "../../utils/errors.js";

import { handleGetWork } from "./index.js";

const PRIDE = {
  key: "/works/OL66554W",
  type: { key: "/type/work" },
  title: "Pride and Prejudice",
  description: { type: "/type/text", value: "A novel of manners." },
  first_publish_date: "1813",
  subjects: ["Courtship"],
  subject_places: ["England"],
  covers: [-1, 14348537],
  authors: [
    {
      author: { key: "/authors/OL21594A" },
      type: { key: "/type/author_role" },
    },
  ],
  excerpts: [
    {
      excerpt: "It is a truth universally acknowledged…",
      comment: "first sentence",
      author: { key: "/people/seabelis" },
    },
  ],
  links: [
    {
      title: "Wikipedia entry",
      url: "https://en.wikipedia.org/wiki/Pride_and_Prejudice",
      type: { key: "/type/link" },
    },
  ],
  genres: ["/tags/OL169T"],
  revision: 42,
  last_modified: { type: "/type/datetime", value: "2026-11-17T17:33:01" },
};

const AUSTEN_SEARCH = {
  docs: [{ author_key: ["OL21594A"], author_name: ["Jane Austen"] }],
};

describe("handleGetWork", () => {
  it("returns the cleaned-up work record", async () => {
    const { clients } = fakeClients({
      "/works/OL66554W.json": PRIDE,
      "/search.json": AUSTEN_SEARCH,
    });

    const result = await handleGetWork({ work_key: "OL66554W" }, clients);

    expect(result.isError).toBeUndefined();
    expect(jsonBody(result)).toEqual({
      work_key: "OL66554W",
      title: "Pride and Prejudice",
      authors: [{ key: "OL21594A", name: "Jane Austen" }],
      description: "A novel of manners.",
      first_publish_date: "1813",
      subjects: ["Courtship"],
      subject_places: ["England"],
      cover_url: "https://covers.openlibrary.org/b/id/14348537-M.jpg",
      excerpts: [
        {
          excerpt: "It is a truth universally acknowledged…",
          comment: "first sentence",
        },
      ],
      links: [
        {
          title: "Wikipedia entry",
          url: "https://en.wikipedia.org/wiki/Pride_and_Prejudice",
        },
      ],
    });
  });

  it.each(["OL66554W", "/works/OL66554W"])(
    "accepts the work key as %s",
    async (work_key) => {
      const { clients } = fakeClients({
        "/works/OL66554W.json": PRIDE,
        "/search.json": AUSTEN_SEARCH,
      });

      const result = await handleGetWork({ work_key }, clients);

      expect(jsonBody(result).work_key).toBe("OL66554W");
    },
  );

  it("follows a merged work and looks up names under the canonical key", async () => {
    const { clients, get } = fakeClients({
      "/works/OL45883W.json": {
        key: "/works/OL45883W",
        type: { key: "/type/redirect" },
        location: "/works/OL66554W",
      },
      "/works/OL66554W.json": PRIDE,
      "/search.json": AUSTEN_SEARCH,
    });

    const result = await handleGetWork({ work_key: "OL45883W" }, clients);

    expect(jsonBody(result).work_key).toBe("OL66554W");
    expect(get).toHaveBeenCalledWith("/search.json", {
      params: {
        q: "key:/works/OL66554W",
        fields: "author_key,author_name",
        limit: 1,
      },
    });
  });

  it.each([
    [
      "the name lookup fails",
      axiosErrorWithStatus(500, "Internal Server Error"),
    ],
    ["the name lookup finds no doc", { docs: [] }],
  ])("returns authors as keys when %s", async (_, search) => {
    const { clients } = fakeClients({
      "/works/OL66554W.json": PRIDE,
      "/search.json": search,
    });

    const result = await handleGetWork({ work_key: "OL66554W" }, clients);

    expect(result.isError).toBeUndefined();
    expect(jsonBody(result).authors).toEqual([{ key: "OL21594A" }]);
  });

  const authorsFor = async (authors: unknown[], authorName: string[]) => {
    const { clients } = fakeClients({
      "/works/OL66554W.json": { ...PRIDE, authors },
      "/search.json": {
        docs: [{ author_key: ["OL1A", "OL2A"], author_name: authorName }],
      },
    });
    return jsonBody(await handleGetWork({ work_key: "OL66554W" }, clients))
      .authors;
  };

  it("matches names to authors by key, skipping entries without one", async () => {
    const authors = await authorsFor(
      [
        { author: { key: "/authors/OL2A" } },
        {},
        { author: { key: "/authors/OL1A" } },
      ],
      ["First", "Second"],
    );

    expect(authors).toEqual([
      { key: "OL2A", name: "Second" },
      { key: "OL1A", name: "First" },
    ]);
  });

  it("reads legacy author entries that hold the key as a string", async () => {
    const authors = await authorsFor(
      [{ author: "/authors/OL1A" }, { author: { key: "/authors/OL2A" } }],
      ["First", "Second"],
    );

    expect(authors).toEqual([
      { key: "OL1A", name: "First" },
      { key: "OL2A", name: "Second" },
    ]);
  });

  it.each([
    ["fewer names than keys", ["First"], [{ key: "OL1A" }, { key: "OL2A" }]],
    [
      "more names than keys",
      ["Dropped", "First", "Second"],
      [{ key: "OL1A" }, { key: "OL2A" }],
    ],
    [
      "an empty name",
      ["", "Second"],
      [{ key: "OL1A" }, { key: "OL2A", name: "Second" }],
    ],
  ])(
    "never attaches a name it cannot align when the search doc has %s",
    async (_, authorName, expected) => {
      const authors = await authorsFor(
        [
          { author: { key: "/authors/OL1A" } },
          { author: { key: "/authors/OL2A" } },
        ],
        authorName,
      );

      expect(authors).toEqual(expected);
    },
  );

  it("omits fields the record lacks", async () => {
    const { clients } = fakeClients({
      "/works/OL1W.json": {
        key: "/works/OL1W",
        type: { key: "/type/work" },
        title: "Bare",
      },
      "/search.json": { docs: [] },
    });

    const result = await handleGetWork({ work_key: "OL1W" }, clients);

    expect(jsonBody(result)).toEqual({ work_key: "OL1W", title: "Bare" });
  });

  it("reports a missing work as a failed lookup", async () => {
    const result = await handleGetWork(
      { work_key: "/works/OL999W" },
      fakeClients({}).clients,
    );

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "No work found for key: /works/OL999W" }],
    });
  });

  it("reports other API failures", async () => {
    const { clients } = fakeClients({
      "/works/OL1W.json": axiosErrorWithStatus(503, "Service Unavailable"),
    });

    const result = await handleGetWork({ work_key: "OL1W" }, clients);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Open Library API error: 503 Service Unavailable" },
    ]);
  });

  it("rejects a key that is not a work key", async () => {
    await expect(
      handleGetWork({ work_key: "OL7353617M" }, fakeClients({}).clients),
    ).rejects.toThrow(InvalidArgumentsError);
  });
});
