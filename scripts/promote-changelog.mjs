import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UNRELEASED_HEADING = /^## \[Unreleased\].*$/m;

export function promoteChangelog(changelog, { version, date }) {
  if (changelog.includes(`## [${version}]`)) {
    throw new Error(
      `CHANGELOG.md already has a "## [${version}]" entry. ` +
        "Refusing to promote in case this version was already released.",
    );
  }

  if (!UNRELEASED_HEADING.test(changelog)) {
    throw new Error(
      'CHANGELOG.md has no "## [Unreleased]" section to promote. ' +
        "Add one describing this release, then run npm version again. " +
        "To undo the partial bump: git restore --source=HEAD --staged --worktree " +
        "package.json package-lock.json server.json",
    );
  }

  return changelog.replace(UNRELEASED_HEADING, `## [${version}] - ${date}`);
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const changelogUrl = new URL("../CHANGELOG.md", import.meta.url);
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const date = new Date().toISOString().slice(0, 10);

  const promoted = promoteChangelog(readFileSync(changelogUrl, "utf8"), {
    version: pkg.version,
    date,
  });

  writeFileSync(changelogUrl, promoted);
  console.log(`CHANGELOG.md promoted to ${pkg.version} - ${date}`);
}
