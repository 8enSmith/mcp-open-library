import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isMainModule } from "./main-module.js";

let dir: string;
let entrypoint: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "main-module-"));
  entrypoint = join(dir, "index.js");
  writeFileSync(entrypoint, "");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("isMainModule", () => {
  it("matches when the entrypoint is run directly", () => {
    expect(isMainModule(pathToFileURL(entrypoint).href, entrypoint)).toBe(true);
  });

  // The npx case, and the reason this helper exists. npm links a package's bin
  // into node_modules/.bin as a symlink and runs that path, so argv[1] is the
  // link while import.meta.url is the realpath of its target. Comparing the two
  // as given never matches, and the server exits 0 without starting.
  it("matches when the entrypoint is reached through a symlinked bin shim", () => {
    const shim = join(dir, "cli-shim");
    symlinkSync(entrypoint, shim);

    expect(isMainModule(pathToFileURL(entrypoint).href, shim)).toBe(true);
  });

  it("matches when the path contains characters that URL-encode", () => {
    const spaced = mkdtempSync(join(tmpdir(), "main module "));
    const target = join(spaced, "index.js");
    writeFileSync(target, "");

    try {
      expect(isMainModule(pathToFileURL(target).href, target)).toBe(true);
    } finally {
      rmSync(spaced, { recursive: true, force: true });
    }
  });

  it("does not match an unrelated entrypoint", () => {
    const other = join(dir, "other.js");
    writeFileSync(other, "");

    expect(isMainModule(pathToFileURL(entrypoint).href, other)).toBe(false);
  });

  it("does not match when there is no argv[1]", () => {
    expect(isMainModule(pathToFileURL(entrypoint).href, undefined)).toBe(false);
  });

  it("does not match when the path no longer exists", () => {
    expect(
      isMainModule(pathToFileURL(entrypoint).href, join(dir, "missing.js")),
    ).toBe(false);
  });
});
