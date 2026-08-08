import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function checkReleaseConsistency({ pkg, server, tag }) {
  const problems = [];
  const version = pkg.version;

  if (tag !== undefined) {
    const tagVersion = tag.startsWith("v") ? tag.slice(1) : tag;
    if (tagVersion !== version) {
      problems.push(
        `git tag "${tag}" does not match package.json version "${version}"`,
      );
    }
  }

  if (server.version !== version) {
    problems.push(
      `server.json version "${server.version}" does not match package.json version "${version}"`,
    );
  }

  const entry = server.packages?.[0];

  if (!entry) {
    problems.push("server.json has no packages[0] entry");
  } else {
    if (entry.version !== version) {
      problems.push(
        `server.json packages[0].version "${entry.version}" does not match package.json version "${version}"`,
      );
    }
    if (entry.identifier !== pkg.name) {
      problems.push(
        `server.json packages[0].identifier "${entry.identifier}" does not match package.json name "${pkg.name}"`,
      );
    }
  }

  if (server.name !== pkg.mcpName) {
    problems.push(
      `server.json name "${server.name}" does not match package.json mcpName "${pkg.mcpName}"`,
    );
  }

  return problems;
}

function readJson(relativePath) {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = checkReleaseConsistency({
    pkg: readJson("../package.json"),
    server: readJson("../server.json"),
    tag: process.argv[2],
  });

  if (problems.length > 0) {
    console.error("Release metadata is inconsistent:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.log("Release metadata is consistent.");
}
