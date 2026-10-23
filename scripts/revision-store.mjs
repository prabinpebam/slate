import fs from 'node:fs';
import path from 'node:path';
import { MAX_REVISION_BYTES, REVISION_ID, sha256, verifyRevision } from '../shell/revisions-core.js';

export class RevisionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function safeFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || /[\\:\u0000-\u001f]/.test(relativePath)
      || relativePath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new RevisionError('Unsafe relative path.');
  }
  const resolvedRoot = path.resolve(root);
  let current = resolvedRoot;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new RevisionError('Symbolic links and junctions are not allowed.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}

export function openRevisionStore(repoRoot, host = 'docs') {
  const repo = path.resolve(repoRoot);
  const root = path.resolve(repo, host);
  const relative = path.relative(repo, root);
  const hostKey = relative.split(path.sep).join('/') || '.';
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new RevisionError('Host must be inside the repository.');
  }
  if (!fs.statSync(repo).isDirectory() || fs.lstatSync(repo).isSymbolicLink()) throw new RevisionError('Repository must be a real directory.');
  if (relative) safeFile(repo, relative.split(path.sep).join('/'));
  if (!fs.statSync(root).isDirectory()) throw new RevisionError('Host must be an existing directory.');

  function directory(create = false) {
    const result = safeFile(repo, '.slate/revisions');
    if (create) fs.mkdirSync(result, { recursive: true });
    return result;
  }
  function file(id) {
    if (!REVISION_ID.test(id)) throw new RevisionError('Invalid revision ID.');
    return safeFile(repo, `.slate/revisions/${id}.json`);
  }
  async function readAny(id) {
    const target = file(id);
    if (!fs.existsSync(target)) throw new RevisionError('Revision not found.', 404);
    if (fs.statSync(target).size > MAX_REVISION_BYTES) throw new RevisionError('Revision exceeds 8 MiB.', 413);
    const revision = await verifyRevision(JSON.parse(fs.readFileSync(target, 'utf8')));
    if (revision.id !== id) throw new RevisionError('Revision filename and ID disagree.');
    return revision;
  }
  async function read(id) {
    const revision = await readAny(id);
    if (revision.host !== hostKey) throw new RevisionError('This revision belongs to a different documentation host.', 404);
    return revision;
  }
  async function list() {
    const dir = directory();
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort();
    const revisions = [];
    for (const name of entries) {
      const revision = await readAny(name.slice(0, -5));
      if (revision.host === hostKey) revisions.push(revision);
    }
    return revisions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async function write(revision, expectedVersion) {
    await verifyRevision(revision);
    if (revision.host !== hostKey) throw new RevisionError('Revision host does not match this reader.');
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new RevisionError('An expected version is required.');
    const dir = directory(true);
    const lockPath = safeFile(repo, '.slate/revisions/.write.lock');
    let lock;
    let temporary;
    try {
      try { lock = fs.openSync(lockPath, 'wx'); }
      catch (error) {
        if (error.code === 'EEXIST') throw new RevisionError('Revision store is locked by another writer. Retry after it finishes; inspect a persistent lock before removing it.', 409);
        throw error;
      }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      const target = file(revision.id);
      const exists = fs.existsSync(target);
      const current = exists ? JSON.parse(fs.readFileSync(target, 'utf8')) : null;
      if (current) await verifyRevision(current);
      if (current && current.host !== hostKey) throw new RevisionError('This revision ID belongs to a different documentation host.', 409);
      // A lost response may cause the same exact write to be retried.
      if (current && JSON.stringify(current) === JSON.stringify(revision)) return current;
      if ((current?.version || 0) !== expectedVersion) throw new RevisionError('Revision conflict: another writer changed this file. Pending edits remain in browser recovery; reload the workspace version before continuing.', 409);
      if (current && (revision.version !== current.version + 1 || revision.createdAt !== current.createdAt)) {
        throw new RevisionError('An update must preserve createdAt and increment version by one.');
      }
      const candidate = path.join(dir, `${revision.id}.${crypto.randomUUID()}.tmp`);
      const descriptor = fs.openSync(candidate, 'wx');
      temporary = candidate;
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(revision, null, 2)}\n`);
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, target);
      temporary = null;
      return revision;
    } finally {
      if (temporary) fs.rmSync(temporary, { force: true });
      if (lock !== undefined) {
        fs.closeSync(lock);
        fs.rmSync(lockPath);
      }
    }
  }
  async function check(id) {
    const revision = await read(id);
    const openSources = new Set(revision.comments.filter(comment => comment.status === 'open')
      .flatMap(comment => comment.targets.map(target => target.sourceId)));
    const results = [];
    for (const source of revision.sources) {
      const target = safeFile(root, source.path);
      if (!fs.existsSync(target)) results.push({ path: source.path, status: 'missing', pending: openSources.has(source.id) });
      else {
        const actual = await sha256(fs.readFileSync(target, 'utf8'));
        results.push({ path: source.path, status: actual === source.sha256 ? 'current' : 'stale', pending: openSources.has(source.id), expected: source.sha256, actual });
      }
    }
    return results;
  }
  return { root, host: hostKey, revisionRoot: path.join(repo, '.slate', 'revisions'), read, list, write, check };
}
