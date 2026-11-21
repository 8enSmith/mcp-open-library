import { describe, expect, it } from "vitest";

import { axiosErrorWithStatus } from "../test-support/axios-error.js";
import { fakeClients } from "../test-support/fake-clients.js";

import { fetchWork, firstCoverUrl, toBareKey, workKeySchema } from "./works.js";

const work = (key: string, extra = {}) => ({
  key: `/works/${key}`,
  type: { key: "/type/work" },
  ...extra,
});

const redirect = (key: string, location?: string) => ({
  key: `/works/${key}`,
  type: { key: "/type/redirect" },
  location,
});

describe("workKeySchema", () => {
  it.each(["OL45804W", "/works/OL45804W"])("accepts %s", (key) => {
    expect(workKeySchema.safeParse(key).success).toBe(true);
  });

  it.each([
    "",
    "OL7353617M",
    "OL34184A",
    "ol45804w",
    "/books/OL45804W",
    "OL45804W/editions",
  ])("rejects %j", (key) => {
    expect(workKeySchema.safeParse(key).success).toBe(false);
  });
});

describe("toBareKey", () => {
  it.each([
    ["/works/OL45804W", "OL45804W"],
    ["OL45804W", "OL45804W"],
    ["/books/OL7353617M", "OL7353617M"],
    ["/authors/OL34184A", "OL34184A"],
    ["/languages/eng", "eng"],
  ])("turns %s into %s", (key, bare) => {
    expect(toBareKey(key)).toBe(bare);
  });
});

describe("firstCoverUrl", () => {
  it.each([
    [
      [-1, 15152634, 8739161],
      "https://covers.openlibrary.org/b/id/15152634-M.jpg",
    ],
    [[-1], undefined],
    [[], undefined],
    [undefined, undefined],
  ])("maps %j to %s", (covers, url) => {
    expect(firstCoverUrl(covers)).toBe(url);
  });
});

describe("fetchWork", () => {
  it("returns a work under its own key even when it carries a stray location", async () => {
    const { clients } = fakeClients({
      "/works/OL45804W.json": work("OL45804W", {
        location: "/works/OL45883W",
      }),
    });

    expect(await fetchWork(clients.api, "OL45804W")).toMatchObject({
      found: true,
      key: "OL45804W",
    });
  });

  it("follows one redirect to the canonical work", async () => {
    const { clients } = fakeClients({
      "/works/OL45883W.json": redirect("OL45883W", "/works/OL45804W"),
      "/works/OL45804W.json": work("OL45804W", { title: "Fantastic Mr Fox" }),
    });

    expect(await fetchWork(clients.api, "OL45883W")).toEqual({
      found: true,
      key: "OL45804W",
      work: work("OL45804W", { title: "Fantastic Mr Fox" }),
    });
  });

  it.each([
    ["a 404", {}],
    [
      "a redirect to a redirect",
      {
        "/works/OL1W.json": redirect("OL1W", "/works/OL2W"),
        "/works/OL2W.json": redirect("OL2W", "/works/OL3W"),
        "/works/OL3W.json": work("OL3W"),
      },
    ],
    [
      "a redirect to a missing work",
      { "/works/OL1W.json": redirect("OL1W", "/works/OL2W") },
    ],
    ["a redirect without a location", { "/works/OL1W.json": redirect("OL1W") }],
    [
      "a redirect to a non-work path",
      {
        "/works/OL1W.json": redirect("OL1W", "/books/OL2M"),
        "/books/OL2M.json": work("OL2M"),
      },
    ],
    [
      "a deleted record",
      {
        "/works/OL1W.json": {
          key: "/works/OL1W",
          type: { key: "/type/delete" },
        },
      },
    ],
  ])("treats %s as not found", async (_, routes) => {
    const { clients } = fakeClients(routes);

    expect(await fetchWork(clients.api, "OL1W")).toEqual({ found: false });
  });

  it("rethrows failures other than 404", async () => {
    const failure = axiosErrorWithStatus(503, "Service Unavailable");
    const { clients } = fakeClients({ "/works/OL1W.json": failure });

    await expect(fetchWork(clients.api, "OL1W")).rejects.toBe(failure);
  });
});
