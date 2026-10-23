import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveRevision, reopenRevision, verifyRevision } from '../shell/revisions-core.js';
import { openRevisionStore } from './revision-store.mjs';

export async function revisionCommand(args) {
  const [command, ...flags] = args;
  const options = {};
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    if (!['--repo', '--host', '--id', '--version', '--summary', '--file'].includes(flag) || !flags[index + 1] || options[flag] !== undefined) {
      throw new Error('Usage: revisions.mjs list|show|check|archive|reopen|import --repo ROOT --host docs [--id ID] [--version N] [--summary TEXT] [--file PATH]');
    }
    options[flag] = flags[index + 1];
  }
  const store = openRevisionStore(options['--repo'] || process.cwd(), options['--host'] || 'docs');
  if (command === 'list') {
    return (await store.list()).map(({ id, host, name, status, version, comments, updatedAt }) => ({ id, host, name, status, version, comments: comments.length, updatedAt }));
  }
  if (command === 'import') {
    if (!options['--file']) throw new Error('Import requires --file.');
    const revision = await verifyRevision(JSON.parse(fs.readFileSync(path.resolve(options['--file']), 'utf8')));
    if ((await store.list()).some(item => item.id === revision.id)) throw new Error('A revision with this ID already exists. Import cannot overwrite it.');
    return store.write(revision, 0);
  }
  if (!['show', 'check', 'archive', 'reopen'].includes(command)) throw new Error('Unknown revision command. Use list, show, check, archive, reopen, or import.');
  const revision = await store.read(options['--id']);
  if (command === 'show') return revision;
  if (command === 'check') return store.check(revision.id);
  const version = Number(options['--version']);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Archive/reopen requires the --version read before acting.');
  if (version !== revision.version) throw new Error('Revision conflict: re-read all comments before acting on the new version.');
  return store.write(command === 'archive'
    ? archiveRevision(revision, options['--summary'] || '')
    : reopenRevision(revision), version);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await revisionCommand(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (process.argv[2] === 'check' && result.some(source => source.pending && source.status !== 'current')) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
