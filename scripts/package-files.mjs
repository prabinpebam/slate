import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [...new Set([...execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean), 'package-files.json'])].sort();
const output = `${JSON.stringify({ version: 1, files }, null, 2)}\n`;
const file = resolve(root, 'package-files.json');
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== output) throw new Error('Package file list is stale. Review source additions, then run scripts/package-files.mjs.');
} else writeFileSync(file, output);
