#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [, , ...restArgs] = process.argv;
const nameArg = restArgs.find((arg) => arg.startsWith('--name='));
const workspace = nameArg?.slice('--name='.length);

if (!workspace) {
  console.error('Missing --name=<package-name>');
  process.exit(1);
}

const packagesDir = path.join(process.cwd(), 'packages');
if (!existsSync(packagesDir)) {
  console.error('packages directory not found');
  process.exit(1);
}

const dirs = readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const match = dirs
  .map((entry) => path.join(packagesDir, entry.name, 'package.json'))
  .filter((packageJsonPath) => existsSync(packageJsonPath))
  .map((packageJsonPath) => ({
    packageJsonPath,
    pkg: JSON.parse(readFileSync(packageJsonPath, 'utf8')),
  }))
  .find(({ pkg }) => pkg.name === workspace);

if (!match) {
  console.error(`Workspace package not found: ${workspace}`);
  process.exit(1);
}

const version = match.pkg.version;
if (!version) {
  console.error(`No version found in ${match.packageJsonPath}`);
  process.exit(1);
}

const tag = `${workspace}-v${version}`;
console.log(tag);

const result = spawnSync('git', ['tag', tag], { stdio: 'inherit' });
process.exit(result.status ?? 1);
