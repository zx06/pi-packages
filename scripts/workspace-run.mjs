#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const [, , npmCommand, ...restArgs] = process.argv;
const nameArg = restArgs.find((arg) => arg.startsWith('--name='));
const workspace = nameArg?.slice('--name='.length);

if (!npmCommand) {
  console.error('Usage: node scripts/workspace-run.mjs <pack|publish> --name=<package-name>');
  process.exit(1);
}

if (!workspace) {
  console.error('Missing --name=<package-name>');
  process.exit(1);
}

const args = [npmCommand, '--workspace', workspace];
if (npmCommand === 'publish') {
  args.push('--access', 'public');
}

const result = spawnSync('npm', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
