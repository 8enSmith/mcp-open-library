import { describe, it, expect } from "vitest";

import { promoteChangelog } from "./promote-changelog.mjs";

const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- A new thing
- A note that mentions Unreleased work in prose

### Fixed
- A bug

## [1.0.2] - 2026-02-04
### Changed
- Updated dependencies
`;

describe("promoteChangelog", () => {
  it("replaces the Unreleased heading with the version and date", () => {
    const result = promoteChangelog(CHANGELOG, {
      version: "1.0.3",
      date: "2026-08-09",
    });

    expect(result).toContain("## [1.0.3] - 2026-08-09");
    expect(result).not.toContain("## [Unreleased]");
  });

  it("keeps the entries that were under the Unreleased heading", () => {
    const result = promoteChangelog(CHANGELOG, {
      version: "1.0.3",
      date: "2026-08-09",
    });

    expect(result).toContain("- A new thing");
    expect(result).toContain("- A bug");
    expect(result).toContain("### Added");
    expect(result).toContain("### Fixed");
  });

  it("leaves prose mentioning Unreleased untouched", () => {
    const result = promoteChangelog(CHANGELOG, {
      version: "1.0.3",
      date: "2026-08-09",
    });

    expect(result).toContain("- A note that mentions Unreleased work in prose");
  });

  it("leaves earlier releases and the preamble untouched", () => {
    const result = promoteChangelog(CHANGELOG, {
      version: "1.0.3",
      date: "2026-08-09",
    });

    expect(result).toContain("## [1.0.2] - 2026-02-04");
    expect(result).toContain("- Updated dependencies");
    expect(result).toContain(
      "All notable changes to this project will be documented in this file.",
    );
    expect(result.startsWith("# Changelog")).toBe(true);
  });

  it("changes exactly one line", () => {
    const result = promoteChangelog(CHANGELOG, {
      version: "1.0.3",
      date: "2026-08-09",
    });

    const before = CHANGELOG.split("\n");
    const after = result.split("\n");

    expect(after).toHaveLength(before.length);

    const changed = before
      .map((line, i) => (line === after[i] ? null : i))
      .filter((i) => i !== null);

    expect(changed).toHaveLength(1);
    expect(before[changed[0]]).toBe("## [Unreleased]");
    expect(after[changed[0]]).toBe("## [1.0.3] - 2026-08-09");
  });

  it("throws when there is no Unreleased section to promote", () => {
    const noUnreleased = `# Changelog

## [1.0.2] - 2026-02-04
### Changed
- Updated dependencies
`;

    expect(() =>
      promoteChangelog(noUnreleased, { version: "1.0.3", date: "2026-08-09" }),
    ).toThrow(/no "## \[Unreleased\]" section/);
  });

  it("throws rather than promoting twice when the version already has an entry", () => {
    const alreadyReleased = `# Changelog

## [Unreleased]
### Added
- Something

## [1.0.3] - 2026-08-09
### Added
- Already shipped
`;

    expect(() =>
      promoteChangelog(alreadyReleased, {
        version: "1.0.3",
        date: "2026-08-09",
      }),
    ).toThrow(/already has a "## \[1\.0\.3\]" entry/);
  });

  it("does not mutate the input string's source changelog content", () => {
    const original = CHANGELOG;
    promoteChangelog(CHANGELOG, { version: "1.0.3", date: "2026-08-09" });
    expect(CHANGELOG).toBe(original);
  });
});
