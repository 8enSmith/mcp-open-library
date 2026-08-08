import { describe, it, expect } from "vitest";

import { checkReleaseConsistency } from "./assert-release-consistency.mjs";

const pkg = {
  name: "mcp-open-library",
  version: "1.0.3",
  mcpName: "io.github.8enSmith/mcp-open-library",
};

const server = {
  name: "io.github.8enSmith/mcp-open-library",
  version: "1.0.3",
  packages: [{ identifier: "mcp-open-library", version: "1.0.3" }],
};

const changelog = `# Changelog

## [1.0.3] - 2026-08-09
### Added
- The thing

## [1.0.2] - 2026-02-04
### Changed
- Updated dependencies
`;

describe("checkReleaseConsistency", () => {
  it("returns no problems when everything agrees", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "v1.0.3" })).toEqual([]);
  });

  it("returns no problems when the changelog has an entry for the version", () => {
    expect(
      checkReleaseConsistency({ pkg, server, tag: "v1.0.3", changelog }),
    ).toEqual([]);
  });

  it("skips the changelog check when no changelog is supplied", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "v1.0.3" })).toEqual([]);
  });

  it("reports a changelog with no entry for the version being released", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server,
      tag: "v1.0.3",
      changelog: `# Changelog

## [Unreleased]
### Added
- Forgot to promote this before releasing

## [1.0.2] - 2026-02-04
`,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("CHANGELOG.md");
    expect(problems[0]).toContain("1.0.3");
  });

  it("skips the tag check when no tag is supplied", () => {
    expect(checkReleaseConsistency({ pkg, server })).toEqual([]);
  });

  it("accepts a tag without the v prefix", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "1.0.3" })).toEqual([]);
  });

  it("reports a tag that does not match package.json", () => {
    const problems = checkReleaseConsistency({ pkg, server, tag: "v9.9.9" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("git tag");
  });

  it("reports a server.json version mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, version: "1.0.2" },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("server.json version");
  });

  it("reports a packages[0].version mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        ...server,
        packages: [{ identifier: "mcp-open-library", version: "1.0.2" }],
      },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0].version");
  });

  it("reports a packages[0].identifier mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        ...server,
        packages: [{ identifier: "wrong-package", version: "1.0.3" }],
      },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0].identifier");
  });

  it("reports a name/mcpName mismatch", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, name: "io.github.8enSmith/wrong-name" },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("mcpName");
  });

  it("reports a missing packages entry", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: { ...server, packages: [] },
      tag: "v1.0.3",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages[0]");
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const problems = checkReleaseConsistency({
      pkg,
      server: {
        name: "io.github.8enSmith/wrong-name",
        version: "1.0.1",
        packages: [{ identifier: "wrong-package", version: "1.0.2" }],
      },
      tag: "v9.9.9",
    });
    expect(problems).toHaveLength(5);
  });
});
