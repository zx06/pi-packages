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
