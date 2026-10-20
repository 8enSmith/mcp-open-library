# Contributing to mcp-open-library

Thanks for your interest in improving this project! Bug reports, fixes, documentation improvements
and new tools are all welcome.

## Before you start

- **Bug fixes and small improvements** — go ahead and open a pull request.
- **New tools, changes to a tool's inputs or outputs, or anything larger** — please
  [open an issue](https://github.com/8enSmith/mcp-open-library/issues) first so we can agree on the
  approach before you spend time on it.

### Reporting a bug

A good bug report includes:

- the tool you called (e.g. `get_book_by_id`) and the exact arguments you passed
- the text the tool returned — failures come back as a tool result flagged `isError`, so the
  error message is in the result itself
- the MCP client you were using (Claude Desktop, the MCP Inspector, …)
- the version of `mcp-open-library` and of Node.js (`node --version`)

If the server is faithfully returning data that is itself wrong — a misattributed author, a missing
cover, a bad publish date — that's a problem in the Open Library catalogue rather than in this
server. Open Library records are community-editable, so it's best fixed at
[openlibrary.org](https://openlibrary.org).

### Reporting a security issue

Please **don't** open a public issue for a security vulnerability. Report it privately through
the repository's [Security tab](https://github.com/8enSmith/mcp-open-library/security/advisories/new)
instead.

## Development setup

[Fork the repository](https://github.com/8enSmith/mcp-open-library/fork), then:

```bash
git clone https://github.com/<your-username>/mcp-open-library.git
cd mcp-open-library
nvm use        # Node is pinned in .nvmrc
npm install
npx husky      # installs the pre-commit hook
```

The pre-commit hook runs ESLint and Prettier on your staged files, then the full test suite, so
commits take a little while but arrive already checked.

To try your changes in a real client, build the server and open it in the MCP Inspector:

```bash
npm run build
npm run inspector
```

The README's [Available Scripts](README.md#available-scripts) section lists the other commands.

## Making changes

### Code

- The project is ESM with `moduleResolution: nodenext`, so relative imports need the `.js`
  extension even in TypeScript source (`import { foo } from "./types.js"`).
- The ESLint rule most likely to catch you out is `import/order`: builtin → external → internal →
  parent → sibling → index → object → type, alphabetised, with a blank line between groups.
  `npm run lint:fix` will sort it for you.
- A tool's input is declared once, as a zod schema, and the JSON Schema that clients see is
  generated from it. `.refine()` rules are dropped in that conversion, so any cross-field rule also
  needs stating in the tool's `description`.
- Tool failures are returned as results with `isError: true`, not thrown as protocol errors. Use
  the helpers in `src/utils/results.ts` and `src/utils/errors.ts` rather than building results by
  hand.

### Adding a tool

Create a directory under `src/tools/<tool-name>/` containing `index.ts` and `index.test.ts`, add
its definition to `TOOLS` in `src/tools/registry.ts`, then refresh the schema snapshot with
`npx vitest run -u`. The README's [Development](README.md#development) section explains the
layout in more detail.

### Tests

- Test behaviour, not implementation: assert on what a tool returns rather than on how it got
  there.
- Handlers receive their HTTP clients as an argument, so tests pass in stubs for `api.get` and
  `covers.head`. To simulate an Open Library failure, use `axiosErrorWithStatus` from
  `src/test-support/` rather than hand-building an axios error.
- Prefer one table-driven test (`it.each`) over several near-identical cases.
- Output from passing tests is hidden, so a `console.log` added to debug a passing test prints
  nothing. Run the file with `--silent=false` to see it:

  ```bash
  npx vitest run src/tools/get-book-by-id/index.test.ts --silent=false
  ```

### Changelog

Add an entry describing your change under `## [Unreleased]` at the top of
[`CHANGELOG.md`](CHANGELOG.md), creating the heading if it isn't there. Entries follow
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and are grouped under `### Added`,
`### Changed`, `### Fixed`, `### Removed` or `### Security`. Write them for someone using the
server, not for someone reading the diff.

Please don't change `version` in `package.json`, edit `server.json`, or run `npm version` —
releases are cut by the maintainer (see [Releasing](README.md#releasing)).

## Pull requests

Before opening a pull request, run:

```bash
npm run lint
npm run test:precommit
npm run build
```

CI doesn't run these on every pull request, so please make sure they pass locally.

- Keep each pull request focused on one change.
- Pull requests are squash-merged, so the PR title becomes the commit message. Please write it as
  a [Conventional Commit](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`,
  `chore: …`, `ci: …`, optionally with a scope such as `fix(deps): …`.
- Say what changed, why, and how you tested it — for example, which tool calls you tried in the
  Inspector.
- If you change a tool's inputs or outputs, update the examples in the README to match.

## License

By contributing, you agree that your contributions will be licensed under the project's
[MIT License](LICENSE.md).
