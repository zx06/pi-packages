# pi-packages

A monorepo for multiple pi packages.

## Structure

```text
packages/
  tavily-tools/
```

## Workspace commands

```bash
cd ~/projects/my/pi-packages
npm install
npm run pack:tavily-tools
npm run publish:tavily-tools
```

Generic monorepo helpers:

```bash
npm run test:tavily-tools
npm run pack:workspace -- --name=pi-tavily-tools
npm run publish:workspace -- --name=pi-tavily-tools
npm run tag:workspace -- --name=pi-tavily-tools
```

## Publish flow

### Publish a workspace package directly

```bash
cd ~/projects/my/pi-packages/packages/tavily-tools
npm publish --access public
```

### Publish with GitHub Actions

Use package-level tags in this monorepo:

```bash
<package-name>-v<version>
```

Example:

```bash
git tag pi-tavily-tools-v0.1.0
git push origin pi-tavily-tools-v0.1.0
```

The release workflow will:

- only run for package release tags
- require the tag commit to be on `main`
- resolve the workspace package from the tag
- verify the tag version matches that package's `package.json`
- fail early if that package version already exists on npm
- publish only that package to npm
- create a GitHub Release with generated notes
- attach the packed `npm pack` tarball to the GitHub Release

## Install locally with pi

```bash
pi install ~/projects/my/pi-packages/packages/tavily-tools
```
