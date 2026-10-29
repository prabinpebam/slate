import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepare, apply } from './install-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), work = join(root, '.contract-tests');
mkdirSync(work, { recursive: true });
function tree(root) {
  return Object.fromEntries(readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => e.isDirectory()
    ? [[`${e.name}/`, null], ...Object.entries(tree(join(root, e.name))).map(([k, v]) => [`${e.name}/${k}`, v])]
    : [[e.name, readFileSync(join(root, e.name)).toString('base64')]]));
}
function fixture(t) {
  const project = mkdtempSync(join(work, 'case-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  const run = (...args) => {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'init-project.mjs'), '--repo', project, '--for', 'copilot,claude-code,codex,cursor', '--json', ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return { code: r.status, ...JSON.parse(r.stdout) };
  };
  return { project, run };
}
test('Slate contract: dry run, exact approval, all agent adapters, idempotency, exact uninstall', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.project, 'owner.txt'), 'Keep me.');
  const before = tree(f.project), plan = f.run('--dry-run');
  assert.equal(plan.code, 0, plan.message);
  assert.deepEqual(tree(f.project), before);
  assert.equal(f.run('--approve-plan', '0'.repeat(64)).code, 2);
  assert.equal(f.run('--approve-plan', plan.plan.digest).code, 0);
  for (const dir of ['.github', '.claude', '.agents']) assert.match(readFileSync(join(f.project, dir, 'skills', 'slate', 'SKILL.md'), 'utf8'), /\.kits\/slate/);
  assert.equal(f.run().plan.writes.length, 0);
  const remove = f.run('--uninstall');
  assert.equal(remove.code, 0, remove.message);
  assert.deepEqual(tree(f.project), before);
});
test('Slate keeps authored content and refuses modified runtime uninstall', (t) => {
  const f = fixture(t);
  assert.equal(f.run().code, 0);
  writeFileSync(join(f.project, 'docs', 'landing.html'), '<h1>My content</h1>');
  assert.equal(f.run().code, 0);
  assert.match(readFileSync(join(f.project, 'docs', 'landing.html'), 'utf8'), /My content/);
  const before = tree(f.project);
  assert.equal(f.run('--yes', '--uninstall').code, 2);
  assert.deepEqual(tree(f.project), before);
  assert.equal(f.run('--host', '../outside').code, 1);
  assert.equal(f.run('--global').code, 1);
});
test('a copied source installs only its reviewed package list, never stray local files', (t) => {
  const f = fixture(t), source = mkdtempSync(join(work, 'source-'));
  t.after(() => rmSync(source, { recursive: true, force: true }));
  for (const path of JSON.parse(readFileSync(join(root, 'package-files.json'))).files) {
    const target = join(source, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(join(root, ...path.split('/'))));
  }
  writeFileSync(join(source, 'unlisted-local-note.txt'), 'Disposable unlisted content.');
  writeFileSync(join(source, 'shell', 'vendor', 'unlisted-local-note.txt'), 'Disposable unlisted content.');
  const result = spawnSync(process.execPath, [join(source, 'scripts', 'init-project.mjs'), '--repo', f.project, '--for', 'copilot', '--json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(join(f.project, '.kits', 'slate', 'unlisted-local-note.txt')), false);
  assert.equal(existsSync(join(f.project, 'docs', 'shell', 'vendor', 'unlisted-local-note.txt')), false);
  assert.equal(existsSync(join(f.project, '.kits', 'slate', 'SKILL.md')), true);
});
test('uninstall leaves pre-existing starters and files made after install untouched', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.project, 'docs'), { recursive: true });
  writeFileSync(join(f.project, 'docs', 'landing.html'), '<h1>My existing landing</h1>\r\n');
  writeFileSync(join(f.project, 'docs', 'slate.config.json'), '{ "projectName": "Mine" }\n');
  const seeded = tree(join(f.project, 'docs'));
  assert.equal(f.run().code, 0);
  writeFileSync(join(f.project, 'CLAUDE.md'), '# Made later\n');
  const result = f.run('--uninstall');
  assert.equal(result.code, 0, result.message);
  assert.deepEqual(result.plan.conflicts, []);
  assert.deepEqual(tree(join(f.project, 'docs')), seeded);
  assert.equal(readFileSync(join(f.project, 'CLAUDE.md'), 'utf8'), '# Made later\n');
  assert.equal(existsSync(join(f.project, '.kit-state', 'slate.json')), false);
  assert.equal(existsSync(join(f.project, '.kits')), false);
});
test('the engine removes only its own section once the file holds other text', (t) => {
  const f = fixture(t), file = join(f.project, 'AGENTS.md');
  const kit = (id, uninstall = false) => apply(prepare({ id, root: f.project, uninstall, allowed: (p) => p === 'AGENTS.md', entries: [{ path: 'AGENTS.md', section: {
    start: `<!-- ${id}:start -->`, end: `<!-- ${id}:end -->`,
    transform: (text) => text.includes(`<!-- ${id}:start -->`) ? text : `${text.trimEnd()}${text.trim() ? '\n\n' : ''}<!-- ${id}:start -->\n## ${id}\n<!-- ${id}:end -->\n`,
  } }] }));
  kit('first');
  writeFileSync(file, `${readFileSync(file, 'utf8')}\nOwner notes.\n`);
  kit('second');
  const second = readFileSync(file, 'utf8').slice(readFileSync(file, 'utf8').indexOf('<!-- second:start -->'));
  kit('first');
  kit('first', true);
  assert.equal(readFileSync(file, 'utf8'), `Owner notes.\n\n${second}`);
  kit('second', true);
  assert.equal(readFileSync(file, 'utf8'), 'Owner notes.\n');
});
test.after(() => rmSync(work, { recursive: true, force: true }));
