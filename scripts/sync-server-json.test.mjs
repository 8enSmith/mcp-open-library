import { describe, it, expect } from "vitest";

import { syncServerJson } from "./sync-server-json.mjs";

const mcpName = "io.github.8enSmith/mcp-open-library";
const packageName = "mcp-open-library";

function makeServer() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: mcpName,
    title: "Open Library",
    description: "Search books and authors on the Internet Archive's Open Library",
    version: "1.0.2",
    websiteUrl: "https://github.com/8enSmith/mcp-open-library#readme",
    repository: {
      url: "https://github.com/8enSmith/mcp-open-library",
      source: "github",
    },
    packages: [
      {
        registryType: "npm",
        identifier: packageName,
        version: "1.0.2",
        transport: { type: "stdio" },
      },
    ],
  };
}

describe("syncServerJson", () => {
  it("updates the top-level version", () => {
    const result = syncServerJson(makeServer(), {
      version: "1.0.3",
      mcpName,
      packageName,
    });
    expect(result.version).toBe("1.0.3");
  });

  it("updates the matching package entry version", () => {
    const result = syncServerJson(makeServer(), {
      version: "1.0.3",
      mcpName,
      packageName,
    });
    expect(result.packages[0].version).toBe("1.0.3");
  });

  it("leaves package entries for other registries untouched", () => {
    const server = makeServer();
    server.packages.push({
      registryType: "nuget",
      identifier: "Someone.Else",
      version: "9.9.9",
      transport: { type: "stdio" },
    });

    const result = syncServerJson(server, {
      version: "1.0.3",
      mcpName,
      packageName,
    });

    expect(result.packages[1].version).toBe("9.9.9");
  });

  it("leaves a same-identifier entry under another registry untouched", () => {
    const server = makeServer();
    server.packages.push({
      registryType: "nuget",
      identifier: packageName,
      version: "9.9.9",
      transport: { type: "stdio" },
    });

    const result = syncServerJson(server, {
      version: "1.0.3",
      mcpName,
      packageName,
    });

    expect(result.packages[0].version).toBe("1.0.3");
    expect(result.packages[1].version).toBe("9.9.9");
  });

  it("preserves every unrelated field", () => {
    const server = makeServer();
    const result = syncServerJson(server, {
      version: "1.0.3",
      mcpName,
      packageName,
    });

    expect(result.$schema).toBe(server.$schema);
    expect(result.name).toBe(mcpName);
    expect(result.title).toBe("Open Library");
    expect(result.description).toBe(server.description);
    expect(result.websiteUrl).toBe(server.websiteUrl);
    expect(result.repository).toEqual(server.repository);
    expect(result.packages[0].registryType).toBe("npm");
    expect(result.packages[0].transport).toEqual({ type: "stdio" });
  });

  it("does not mutate the input", () => {
    const server = makeServer();
    syncServerJson(server, { version: "1.0.3", mcpName, packageName });
    expect(server.version).toBe("1.0.2");
    expect(server.packages[0].version).toBe("1.0.2");
  });

  it("throws when the server name does not match mcpName", () => {
    expect(() =>
      syncServerJson(makeServer(), {
        version: "1.0.3",
        mcpName: "io.github.8enSmith/something-else",
        packageName,
      }),
    ).toThrow(/does not match/);
  });
});
