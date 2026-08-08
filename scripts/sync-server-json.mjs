import { readFileSync, writeFileSync } from "node:fs";

export function syncServerJson(server, { version, mcpName, packageName }) {
  if (server.name !== mcpName) {
    throw new Error(
      `server.json name "${server.name}" does not match package.json mcpName "${mcpName}". ` +
        "The server name is permanent and must be corrected by hand.",
    );
  }

  return {
    ...server,
    version,
    packages: server.packages.map((entry) =>
      entry.identifier === packageName ? { ...entry, version } : entry,
    ),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const serverUrl = new URL("../server.json", import.meta.url);
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const server = JSON.parse(readFileSync(serverUrl, "utf8"));

  const updated = syncServerJson(server, {
    version: pkg.version,
    mcpName: pkg.mcpName,
    packageName: pkg.name,
  });

  writeFileSync(serverUrl, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`server.json synced to ${pkg.version}`);
}
