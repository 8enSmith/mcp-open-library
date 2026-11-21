import { describe, expect, it } from "vitest";

import { axiosErrorWithStatus } from "../../test-support/axios-error.js";
import { fakeClients, jsonBody } from "../../test-support/fake-clients.js";
import { InvalidArgumentsError } from "../../utils/errors.js";

import { handleGetWorkEditions } from "./index.js";

const EDITIONS = "/works/OL45804W/editions.json";

const PUFFIN = {
  key: "/books/OL7353617M",
  type: { key: "/type/edition" },
  title: "Fantastic Mr. Fox",
  edition_name: "1st Puffin ed.",
  publishers: ["Puffin"],
  publish_date: "October 1, 1988",
  languages: [{ key: "/languages/eng" }],
  isbn_13: ["978-0-14-032872-1"],
  isbn_10: ["0140328726"],
  number_of_pages: 96,
  physical_format: "Paperback",
  covers: [15152634, 8739161, -1],
  works: [{ key: "/works/OL45804W" }],
  source_records: ["ia:fantasticmrfox00dahl_834"],
  local_id: ["urn:bwbsku:KP-140-654"],
  revision: 28,
};

const HEBREW = {
  key: "/books/OL57649219M",
  title: "Mar shuʻal ha-mehulal",
  type: { key: "/type/edition" },
  languages: [{ key: "/languages/heb" }],
};

const PAGE = {
  size: 161,
  links: { self: EDITIONS, work: "/works/OL45804W" },
  entries: [PUFFIN, HEBREW],
};

const workRecord = (key: string) => ({
  key: `/works/${key}`,
  type: { key: "/type/work" },
});

const redirectTo = (key: string, target: string) => ({
  key: `/works/${key}`,
  type: { key: "/type/redirect" },
  location: `/works/${target}`,
});

describe("handleGetWorkEditions", () => {
  it("returns a trimmed page of editions", async () => {
    const { clients } = fakeClients({ [EDITIONS]: PAGE });

    const result = await handleGetWorkEditions(
      { work_key: "/works/OL45804W" },
      clients,
    );

    expect(result.isError).toBeUndefined();
    expect(jsonBody(result)).toEqual({
      work_key: "OL45804W",
      num_found: 161,
      offset: 0,
      limit: 20,
      editions: [
        {
          edition_key: "OL7353617M",
          title: "Fantastic Mr. Fox",
          edition_name: "1st Puffin ed.",
          publishers: ["Puffin"],
          publish_date: "October 1, 1988",
          languages: ["eng"],
          isbn_13: "9780140328721",
          isbn_10: "0140328726",
          number_of_pages: 96,
          physical_format: "Paperback",
          cover_url: "https://covers.openlibrary.org/b/id/15152634-M.jpg",
        },
        {
          edition_key: "OL57649219M",
          title: "Mar shuʻal ha-mehulal",
          languages: ["heb"],
        },
      ],
    });
  });

  it.each([
    [{}, { limit: 20, offset: 0 }],
    [
      { limit: 5, offset: 10 },
      { limit: 5, offset: 10 },
    ],
  ])("pages upstream with %j", async (paging, params) => {
    const { clients, get } = fakeClients({ [EDITIONS]: PAGE });

    const result = await handleGetWorkEditions(
      { work_key: "OL45804W", ...paging },
      clients,
    );

    expect(get).toHaveBeenCalledWith(EDITIONS, { params });
    expect(jsonBody(result)).toMatchObject(params);
  });

  it.each([
    ["past the end", { size: 161, entries: [] }, 161],
    ["missing entries and size", {}, 0],
  ])(
    "returns an empty page when the response is %s",
    async (_, data, numFound) => {
      const { clients } = fakeClients({ [EDITIONS]: data });

      const result = await handleGetWorkEditions(
        { work_key: "OL45804W", offset: 500 },
        clients,
      );

      expect(result.isError).toBeUndefined();
      expect(jsonBody(result)).toMatchObject({
        num_found: numFound,
        editions: [],
      });
    },
  );

  it("retries a merged work under its canonical key", async () => {
    const { clients } = fakeClients({
      "/works/OL45883W.json": redirectTo("OL45883W", "OL45804W"),
      "/works/OL45804W.json": workRecord("OL45804W"),
      [EDITIONS]: PAGE,
    });

    const body = jsonBody(
      await handleGetWorkEditions({ work_key: "OL45883W" }, clients),
    );

    expect(body).toMatchObject({ work_key: "OL45804W", num_found: 161 });
    expect(body.editions).toHaveLength(2);
  });

  it.each([
    ["no work exists", {}],
    [
      "the work exists but its editions 404",
      { "/works/OL999W.json": workRecord("OL999W") },
    ],
    [
      "the canonical work's editions also 404",
      {
        "/works/OL999W.json": redirectTo("OL999W", "OL45804W"),
        "/works/OL45804W.json": workRecord("OL45804W"),
      },
    ],
  ])("reports a missing work when %s", async (_, routes) => {
    const result = await handleGetWorkEditions(
      { work_key: "OL999W" },
      fakeClients(routes).clients,
    );

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "No work found for key: OL999W" }],
    });
  });

  it("reports other API failures", async () => {
    const { clients } = fakeClients({
      [EDITIONS]: axiosErrorWithStatus(503, "Service Unavailable"),
    });

    const result = await handleGetWorkEditions(
      { work_key: "OL45804W" },
      clients,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Open Library API error: 503 Service Unavailable" },
    ]);
  });

  it.each([{ limit: 0 }, { limit: 101 }, { limit: 2.5 }, { offset: -1 }])(
    "rejects paging %j",
    async (paging) => {
      await expect(
        handleGetWorkEditions(
          { work_key: "OL45804W", ...paging },
          fakeClients({}).clients,
        ),
      ).rejects.toThrow(InvalidArgumentsError);
    },
  );
});
