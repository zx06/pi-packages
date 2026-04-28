# AGENTS.md

This repository is a multi-package npm monorepo for pi packages.

## Repository structure

- Root workspace config: `package.json`
- Workspace packages: `packages/*`
- CI workflow: `.github/workflows/ci.yml`
- Release workflow: `.github/workflows/release.yml`
- Monorepo helper scripts: `scripts/*.mjs`

## Development workflow

### Install

Use npm from the repo root:

```bash
npm install
```

This repo uses `package-lock.json`. Keep it updated when dependencies change.

### Local validation

Before committing, run the same basic checks as CI when relevant:

```bash
npm run list
npm run test:tavily-tools
npm run pack:workspace -- --name=<package-name>
```

Example:

```bash
npm run pack:workspace -- --name=pi-tavily-tools
```

### Workspace helper scripts

Use the root-level helper scripts for monorepo operations:

```bash
npm run pack:workspace -- --name=<package-name>
npm run publish:workspace -- --name=<package-name>
npm run tag:workspace -- --name=<package-name>
```

Tag format is:

```bash
<package-name>-v<version>
```

Example:

```bash
npm run tag:workspace -- --name=pi-tavily-tools
```

## CI rules

`ci.yml` runs on pushes to `main` and on pull requests.

Current CI behavior:

- runs on Node 22 and 24
- uses npm cache
- installs dependencies with npm
- lists workspaces
- packs `pi-tavily-tools`
- uploads the tarball artifact on Node 24

When changing CI, keep it compatible with the current npm workspace layout.

## AI Development Best Practices

When AI agents (or any developer) work on this repo, follow these guidelines.

### Documentation First

Every package should have a **SPEC.md** that is the single source of truth. Before writing or changing code:

1. **Read the existing SPEC.md** to understand the package's design intent
2. **Update SPEC.md first** when adding features, commands, or changing behavior
3. **Update README.md** if the change is user-facing (new commands, changed workflow)
4. Keep SPEC and README in sync — they serve different audiences (design vs. usage)

### Type-First Design

Define types and interfaces in `src/types.ts` before implementing logic:

- New data structures → add to `types.ts` first
- New API parameters → define the interface before the implementation
- Keep types narrow and precise (avoid `any`, prefer `unknown` with type guards)

### Code Quality Rules

- **No duplicate code**: Extract shared utilities into `src/utils.ts` or a dedicated module
- **Consistent imports**: All source files within a package should use the same import style
  - With `moduleResolution: "bundler"`, use extensionless imports (`"./types"`)
  - Use `import type` for type-only imports to avoid runtime overhead
- **No dead code**: Remove unused functions, methods, imports, and variables
- **No `require()` in ESM**: Use `import` statements; `"type": "module"` is set at package level
- **Handle errors**: Don't silently swallow exceptions; at minimum log them or propagate with context

### Incremental Changes

- Make small, focused commits with descriptive messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Each commit should address one logical change
- Commit messages should explain _what_ and _why_, not just _how_

### Validation Before Commit

```bash
# Always validate before committing:
npm run pack:workspace -- --name=<package-name>

# Verify syntax:
node --check packages/<dir>/src/*.ts packages/<dir>/extensions/*.ts

# Check final diff:
git diff --stat
```

### Code Review Checklist

When reviewing AI-generated (or any) changes, verify:

- [ ] SPEC.md and README.md are updated if behavior changed
- [ ] Types are defined in `types.ts` before use
- [ ] No duplicate code across files (check for copy-paste)
- [ ] Import paths are consistent with the rest of the package
- [ ] No `require()` calls in ESM packages
- [ ] Error paths are handled (not silently ignored)
- [ ] `npm run pack:workspace` passes
- [ ] Version is bumped according to semver
- [ ] Commit message follows Conventional Commits

### Encoding / Data Safety

- When encoding data for external APIs (like GitHub Gist filenames), use standard, reversible schemes (percent-encoding, base64) rather than ad-hoc replacements
- Collision-prone separators (like `__` for paths) must be encoded in a way that survives round-trips
- Document encoding choices with inline comments explaining _why_ they were chosen

## Release rules

`release.yml` is tag-driven.

A release only runs when a tag matches:

```bash
*-v*
```

The workflow enforces all of the following:

- release tags must point to a commit on `main`
- tag format must be `<package-name>-v<version>`
- the package must exist under `packages/*`
- the tag version must match that package's `package.json`
- the same package version must not already exist on npm

On successful release, the workflow will:

- run `npm pack`
- publish the package to npm
- create a GitHub Release
- attach the generated tarball

## Recommended release process

1. Update the target package version in `packages/<dir>/package.json`
2. If dependencies changed, run:
   ```bash
   npm install
   ```
3. Validate locally:
   ```bash
   npm run pack:workspace -- --name=<package-name>
   ```
4. Commit changes
5. Create the package tag:
   ```bash
   npm run tag:workspace -- --name=<package-name>
   ```
6. Push branch and tags:
   ```bash
   git push origin main --tags
   ```

## Commit hygiene

- Do not commit `node_modules/`
- Do not commit generated `*.tgz` files from `npm pack`
- Commit `package-lock.json` when it changes
- Prefer updating docs when release or workflow behavior changes

## When adding a new package

For each new workspace package:

- place it under `packages/<dir>`
- ensure it has a valid `package.json` with unique `name` and `version`
- verify `npm pack --workspace <package-name>` works
- update README if the package should be documented for users
- keep the package compatible with the release tag convention
