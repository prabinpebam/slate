import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHostIndex } from './init-project.mjs';
import { sourceRuntimeFiles } from './runtime-host.mjs';
import { argumentsFor, prepare, finish, safe, digest } from './install-contract.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const encode = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const packageFiles = () => {
  const manifest = JSON.parse(readFileSync(safe(source, 'package-files.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid package file list.');
  return manifest.files;
};

export function contract(argv) {
  const o = argumentsFor(argv, ['repo', 'host', 'project', 'logical-root']);
  if (o.global) throw new Error('Slate supports project scope only.');
  if (!o.repo && !o.target) throw Object.assign(new Error('Choose --repo <project folder>.'), { code: 2 });
  if (!o.kinds.length) throw Object.assign(new Error('Choose --for copilot,claude,agents explicitly.'), { code: 2 });
  const root = resolve(o.repo ?? o.target), host = o.host ?? 'docs', title = o.project ?? 'Project Documentation';
  safe(root, host);
  if (host.startsWith('.') || host === 'AGENTS.md' || host === 'CLAUDE.md') throw new Error('Choose a dedicated documentation folder.');
  const entries = [];
  // Keep the complete authoring package available after a distributor removes its source cache.
  const packaged = new Set(packageFiles());
  for (const path of packaged) entries.push({ path: `.kits/slate/${path}`, bytes: readFileSync(safe(source, path)) });
  const runtime = sourceRuntimeFiles(source).filter((path) => packaged.has(path));
  for (const path of runtime) entries.push({ path: `${host}/${path}`, bytes: readFileSync(safe(source, path)) });
  const identity = JSON.parse(readFileSync(safe(source, 'package.json'), 'utf8'));
  entries.push({ path: `${host}/.slate-runtime.json`, bytes: encode({
    schemaVersion: 1, sourcePackage: identity.name, sourceVersion: identity.version,
    sourcePath: `${'../'.repeat(host.split('/').length)}.kits/slate`,
    files: runtime.map((path) => ({ path, sha256: digest(readFileSync(safe(source, path))) })),
  }) });
  for (const [path, bytes] of [
    ['index.html', Buffer.from(createHostIndex(source, title))],
    ['slate.config.json', encode({ projectName: title, defaultTheme: 'auto', density: 'comfortable', landing: 'landing.html', themeStylesheet: 'project.theme.css' })],
    ['docs-manifest.json', encode({ version: 2, entries: [{ path: 'landing.html', title: 'Overview', order: 0, icon: 'home', type: 'page' }] })],
    ['project.theme.css', Buffer.from('/* Project-owned theme overrides. */\n:root {}\n')],
    ['landing.html', Buffer.from('<h1>Documentation</h1>\n<p>Add project content and register it in docs-manifest.json.</p>\n')],
  ]) entries.push({ path: `${host}/${path}`, bytes, policy: 'keep' });
  for (const kind of o.kinds) {
    const folder = { copilot: '.github', claude: '.claude', agents: '.agents' }[kind];
    entries.push({ path: `${folder}/skills/slate/SKILL.md`, bytes: Buffer.from('---\nname: slate\ndescription: "Use when creating or maintaining documentation with Slate."\n---\n\nRead and follow [the canonical Slate skill](../../../.kits/slate/SKILL.md).\n') });
  }
  const allowed = (p) => p.startsWith('.kits/slate/') || p.startsWith(`${host}/`)
    || ['.github', '.claude', '.agents'].some((d) => p === `${d}/skills/slate/SKILL.md`);
  return finish(prepare({ id: 'slate', root, entries, allowed, uninstall: o.uninstall, effects: ['writes-project-files'], settings: { kinds: o.kinds, host, project: title } }), o, `Write content in ${host}; keep its manifest current.`);
}
