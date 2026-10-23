import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mock } from 'node:test';
import {
  archiveRevision, createRevision, newId, reopenRevision, revise,
  safeContentPath, sha256, validateRevision, verifyRevision,
} from '../shell/revisions-core.js';
import { openRevisionStore, safeFile } from './revision-store.mjs';
import { startRevisionServer } from './serve-revisions.mjs';
import { revisionCommand } from './revisions.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slate-revisions-'));
const host = path.join(root, 'docs');
fs.mkdirSync(host);
fs.writeFileSync(path.join(host, 'index.html'), '<h1>Reader</h1>');
const sourceContent = '# Delivery\n\nA complete source snapshot.\n';
fs.writeFileSync(path.join(host, 'spec.md'), sourceContent);
let running;
let cases = 0;
function check(action) { action(); cases += 1; }
async function rejects(action, pattern) { await assert.rejects(action, pattern); cases += 1; }

async function fixture() {
  const revision = createRevision(new Date('2026-10-23T06:00:00.000Z'));
  revision.sources.push({
    id: newId('source'), path: 'spec.md', route: 'spec.md', title: 'Delivery',
    sha256: await sha256(sourceContent), content: sourceContent,
  });
  const html = '<p>A complete source snapshot.</p>';
  revision.comments.push({
    id: newId('comment'), text: 'Clarify this requirement.', status: 'open', createdAt: revision.createdAt, updatedAt: revision.updatedAt,
    targets: [{
      sourceId: revision.sources[0].id, selector: 'p:nth-of-type(1)', ordinal: 1, tag: 'p', elementId: '',
      text: 'A complete source snapshot.', html, sha256: await sha256(html),
      occurrence: 1, matches: 1, headings: [{ level: 1, text: 'Delivery', id: '' }],
      before: 'Delivery', after: '',
    }],
  });
  return revision;
}

try {
  const original = await fixture();
  await verifyRevision(original);
  check(() => {
    assert.match(original.name, /^Revision /);
    assert.equal(original.status, 'active');
    assert.equal(original.version, 1);
    assert.equal(validateRevision(original), original);
    assert.ok(safeContentPath('nested/My Spec.MD'));
    for (const unsafe of ['../outside.md', '/spec.md', 'nested//spec.md', 'a\\spec.md', 'a:spec.md', '%2e%2e/spec.md', '.hidden/spec.md', 'a/./spec.md', 'https://example.com/spec.md']) {
      assert.equal(safeContentPath(unsafe), false, unsafe);
    }
  });
  const mutations = [
    revision => { revision.schemaVersion = 2; },
    revision => { revision.extra = 'unexpected'; },
    revision => { revision.name = ' '; },
    revision => { revision.id = '../unsafe'; },
    revision => { revision.host = '../docs'; },
    revision => { revision.version = 0; },
    revision => { revision.createdAt = '2026-02-31T00:00:00.000Z'; },
    revision => { revision.updatedAt = '2025-10-23T06:00:00.000Z'; },
    revision => { revision.sources[0].path = '../outside.md'; },
    revision => { revision.sources.push(structuredClone(revision.sources[0])); },
    revision => { revision.comments.push(structuredClone(revision.comments[0])); },
    revision => { revision.comments[0].targets = []; },
    revision => { revision.comments[0].targets[0].sourceId = newId('source'); },
    revision => { revision.comments[0].targets[0].selector = 'p,script'; },
    revision => { revision.comments[0].targets[0].occurrence = 2; },
    revision => { revision.comments[0].targets[0].headings[0].level = 7; },
    revision => { revision.comments[0].targets.push(structuredClone(revision.comments[0].targets[0])); },
    revision => { revision.status = 'archived'; },
    revision => { revision.resolution = 'Not archived'; },
    revision => { revision.comments[0].updatedAt = '2027-10-23T06:00:00.000Z'; },
    revision => { revision.comments[0].text = 'x'.repeat(20001); },
    revision => { revision.comments[0].status = 'unknown'; },
  ];
  mutations.forEach(mutate => check(() => {
    const invalid = structuredClone(original);
    mutate(invalid);
    assert.throws(() => validateRevision(invalid), /Invalid revision/);
  }));
  check(() => {
    const bounded = structuredClone(original);
    const target = bounded.comments[0].targets[0];
    bounded.comments[0].targets = Array.from({ length: 100 }, (_, index) => ({
      ...structuredClone(target), selector: `p:nth-of-type(${index + 1})`, ordinal: index,
    }));
    assert.equal(validateRevision(bounded), bounded);
    bounded.comments[0].targets.push({ ...structuredClone(target), selector: 'p:nth-of-type(101)', ordinal: 100 });
    assert.throws(() => validateRevision(bounded), /1\.\.100 targets/);
  });
  for (const field of ['content', 'html']) {
    const invalid = structuredClone(original);
    if (field === 'content') invalid.sources[0].content += 'tampered';
    else invalid.comments[0].targets[0].html += '<script>untrusted()</script>';
    await rejects(() => verifyRevision(invalid), /fingerprint mismatch/);
  }
  check(() => assert.throws(() => archiveRevision(original, ' '), /summary/));
  const archived = archiveRevision(original, 'Implemented and tested.');
  await verifyRevision(archived);
  check(() => {
    assert.equal(original.status, 'active', 'Lifecycle operations do not mutate their input');
    assert.equal(archived.status, 'archived');
    assert.equal(archived.version, 2);
    assert.equal(archived.comments.length, 1);
    assert.equal(archived.comments[0].status, 'addressed');
    assert.equal(reopenRevision(archived).comments[0].status, 'addressed', 'Reopening does not re-request completed work');
    assert.equal(reopenRevision(archived).status, 'active');
    assert.equal(reopenRevision(archived).archivedAt, null);
  });
  const store = openRevisionStore(root);
  check(() => assert.throws(() => openRevisionStore(root, '..'), /inside/));
  check(() => assert.throws(() => safeFile(host, '../outside'), /Unsafe/));
  assert.deepEqual(await store.list(), []);
  await store.write(original, 0);
  check(() => {
    assert.equal(fs.existsSync(path.join(root, '.slate', 'revisions', `${original.id}.json`)), true, 'JSON is automatically saved at the parent project root');
    assert.equal(fs.existsSync(path.join(host, '.slate')), false, 'Revisions do not live inside the documentation host');
  });
  assert.deepEqual(await store.read(original.id), original);
  assert.deepEqual(await store.write(original, 0), original, 'Lost-response replay is idempotent');
  check(() => assert.equal(fs.readdirSync(path.join(root, '.slate', 'revisions')).length, 1));
  const changed = revise(original, revision => { revision.name = 'Updated name'; });
  await store.write(changed, 1);
  await rejects(() => store.write(archiveRevision(original, 'Stale writer'), 1), /conflict/);
  await rejects(() => store.write(revise(changed, revision => { revision.version += 5; }), 2), /increment version/);
  const lock = path.join(root, '.slate', 'revisions', '.write.lock');
  fs.writeFileSync(lock, 'existing lock');
  await rejects(() => store.write(archiveRevision(changed, 'Verified'), 2), /locked/);
  check(() => assert.equal(fs.readFileSync(lock, 'utf8'), 'existing lock', 'A failed lock does not delete another writer lock'));
  fs.rmSync(lock);
  const collisionId = '00000000-0000-4000-8000-000000000000';
  const collision = path.join(root, '.slate', 'revisions', `${original.id}.${collisionId}.tmp`);
  fs.writeFileSync(collision, 'existing temporary file');
  const randomUUID = mock.method(crypto, 'randomUUID', () => collisionId);
  try {
    await rejects(() => store.write(archiveRevision(changed, 'Verified'), 2), /EEXIST/);
    check(() => {
      assert.equal(fs.readFileSync(collision, 'utf8'), 'existing temporary file', 'A failed exclusive open preserves the existing file');
      assert.equal(fs.existsSync(lock), false, 'A failed temporary write releases its own lock');
    });
  } finally {
    randomUUID.mock.restore();
    fs.rmSync(collision);
  }
  check(() => assert.equal((fs.readdirSync(path.join(root, '.slate', 'revisions'))).some(name => name.endsWith('.tmp')), false));
  check(() => assert.equal(fs.readFileSync(path.join(host, 'spec.md'), 'utf8'), sourceContent, 'Revision writes never edit content'));
  assert.equal((await store.check(original.id))[0].status, 'current');
  fs.writeFileSync(path.join(host, 'spec.md'), `${sourceContent}\nChanged.\n`);
  assert.equal((await store.check(original.id))[0].status, 'stale');
  fs.rmSync(path.join(host, 'spec.md'));
  assert.equal((await store.check(original.id))[0].status, 'missing');
  fs.writeFileSync(path.join(host, 'spec.md'), sourceContent);
  const external = path.join(root, 'external');
  fs.mkdirSync(external);
  fs.symlinkSync(external, path.join(host, 'linked'), 'junction');
  check(() => assert.throws(() => safeFile(host, 'linked/target.json'), /links and junctions/));
  fs.rmSync(path.join(host, 'linked'));
  const args = ['--repo', root, '--host', 'docs', '--id', original.id];
  assert.equal((await revisionCommand(['list', '--repo', root]))[0].id, original.id);
  assert.equal((await revisionCommand(['show', ...args])).name, 'Updated name');
  assert.equal((await revisionCommand(['check', ...args]))[0].status, 'current');
  await rejects(() => revisionCommand(['archive', ...args, '--summary', 'Done']), /--version/);
  await rejects(() => revisionCommand(['archive', ...args, '--version', '1', '--summary', 'Done']), /conflict/);
  const completed = await revisionCommand(['archive', ...args, '--version', '2', '--summary', 'All requested changes verified.']);
  assert.equal(completed.status, 'archived');
  assert.equal(completed.resolution, 'All requested changes verified.');
  const reactivated = await revisionCommand(['reopen', ...args, '--version', '3']);
  assert.equal(reactivated.status, 'active');
  assert.equal(reactivated.comments.length, 1);
  assert.equal((await store.check(reactivated.id))[0].pending, false);
  const exportPath = path.join(root, 'export.json');
  fs.writeFileSync(exportPath, JSON.stringify(reactivated));
  await rejects(() => revisionCommand(['import', '--repo', root, '--file', exportPath]), /already exists/);
  const fresh = createRevision();
  fs.writeFileSync(exportPath, JSON.stringify(fresh));
  assert.equal((await revisionCommand(['import', '--repo', root, '--file', exportPath])).id, fresh.id);
  const cliPath = fileURLToPath(new URL('./revisions.mjs', import.meta.url));
  const output = spawnSync(process.execPath, [cliPath, 'list', '--repo', root], { encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).length, 2);
  await store.write(revise(reactivated, revision => { revision.comments[0].status = 'open'; }), reactivated.version);
  fs.writeFileSync(path.join(host, 'spec.md'), 'Stale\n');
  const stale = spawnSync(process.execPath, [cliPath, 'check', ...args], { encoding: 'utf8' });
  assert.equal(stale.status, 1);
  assert.equal(JSON.parse(stale.stdout)[0].status, 'stale');
  cases += 10;

  running = await startRevisionServer({ repoRoot: root, port: 0 });
  const { origin } = running;
  const api = `${origin}/__slate/revisions`;
  check(() => assert.equal(running.server.address().address, '127.0.0.1'));
  const response = await fetch(api);
  assert.equal(response.status, 200);
  const capabilities = await response.json();
  assert.equal(capabilities.kind, 'slate-revision-store');
  assert.equal(capabilities.host, 'docs');
  assert.equal(capabilities.storagePath, '.slate/revisions');
  const payload = createRevision();
  function put(headers = {}, body = JSON.stringify(payload)) {
    return fetch(`${api}/${payload.id}`, {
      method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json', 'If-Match': '0', ...headers }, body,
    });
  }
  assert.equal((await put()).status, 200);
  assert.equal((await fetch(`${api}/${payload.id}`)).status, 200);
  assert.equal((await put({}, JSON.stringify(revise(payload, item => { item.name = 'Conflicting update'; })))).status, 409);
  assert.equal((await put({ Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await put({ Origin: '' })).status, 403);
  assert.equal((await put({ 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await put({ 'If-Match': '' })).status, 428);
  assert.equal((await put({}, '{bad json')).status, 400);
  assert.equal((await put({}, JSON.stringify({ ...payload, id: createRevision().id }))).status, 400);
  assert.equal((await put({}, ' '.repeat(8 * 1024 * 1024 + 1))).status, 413);
  async function rawStatus(url, headers) {
    return new Promise((resolve, reject) => {
      http.get(url, { headers }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
  }
  assert.equal(await rawStatus(api, { Host: 'foreign.invalid' }), 403);
  assert.equal(await rawStatus(api, { 'Sec-Fetch-Site': 'cross-site' }), 403);
  assert.equal((await fetch(`${origin}/.slate/revisions/${payload.id}.json`)).status, 403);
  assert.equal((await fetch(`${origin}/index.html`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${origin}/index.html`)).status, 200);
  assert.equal((await fetch(`${origin}/missing.html`)).status, 404);
  const traversalStatus = await new Promise((resolve, reject) => {
    http.get(`${origin}/%2e%2e%2fexternal%2fsecret.md`, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  assert.equal(traversalStatus, 403);
  fs.mkdirSync(path.join(root, 'other', 'guides'), { recursive: true });
  const otherStore = openRevisionStore(root, 'other/guides');
  const otherRevision = createRevision(new Date(), 'other/guides');
  await otherStore.write(otherRevision, 0);
  assert.equal((await otherStore.list()).length, 1);
  assert.ok((await store.list()).every(revision => revision.host === 'docs'));
  assert.ok(fs.existsSync(path.join(root, '.slate', 'revisions', `${otherRevision.id}.json`)));
  await rejects(() => store.read(otherRevision.id), /different documentation host/);
  await rejects(() => store.write(otherRevision, 1), /host does not match/);
  await rejects(() => otherStore.write({ ...otherRevision, id: original.id }, reactivated.version + 1), /different documentation host/);
  cases += 18;
  console.log(`Slate revision core/store/CLI/API tests passed (${cases} cases, including mutation, lifecycle, conflict, and path/origin checks).`);
} finally {
  if (running) {
    running.server.closeAllConnections();
    await new Promise(resolve => running.server.close(resolve));
  }
  fs.rmSync(root, { recursive: true, force: true });
}
