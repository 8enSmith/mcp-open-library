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

describe("checkReleaseConsistency", () => {
  it("returns no problems when everything agrees", () => {
    expect(checkReleaseConsistency({ pkg, server, tag: "v1.0.3" })).toEqual([]);
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
