import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_REVISION_BYTES } from '../shell/revisions-core.js';
import { openRevisionStore, RevisionError, safeFile } from './revision-store.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

async function readBody(request) {
  if (Number(request.headers['content-length']) > MAX_REVISION_BYTES) {
    request.resume();
    throw new RevisionError('Revision request exceeds 8 MiB.', 413);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size <= MAX_REVISION_BYTES) chunks.push(chunk);
    });
    request.on('end', () => {
      if (size > MAX_REVISION_BYTES) reject(new RevisionError('Revision request exceeds 8 MiB.', 413));
      else {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new RevisionError('Request must contain valid JSON.')); }
      }
    });
    request.on('error', reject);
  });
}

export async function startRevisionServer({ repoRoot = process.cwd(), host = 'docs', port = 8765 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RevisionError('Port must be an integer from 0 to 65535.');
  const store = openRevisionStore(repoRoot, host);
  let origin;
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    function json(status, value) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    }
    try {
      if (request.headers.host !== new URL(origin).host) throw new RevisionError('Foreign Host header rejected.', 403);
      if (request.headers.origin && request.headers.origin !== origin) throw new RevisionError('Foreign origin rejected.', 403);
      if (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) {
        throw new RevisionError('Cross-site requests rejected.', 403);
      }
      const pathname = decodeURIComponent(request.url.split('?')[0]);
      if (pathname === '/__slate/revisions' && request.method === 'GET') {
        json(200, { kind: 'slate-revision-store', host: store.host, storagePath: '.slate/revisions', revisions: await store.list() });
        return;
      }
      if (pathname.startsWith('/__slate/revisions/')) {
        const id = pathname.slice('/__slate/revisions/'.length);
        if (request.method === 'GET') { json(200, await store.read(id)); return; }
        if (request.method !== 'PUT') throw new RevisionError('Only GET and PUT are supported.', 405);
        if (request.headers.origin !== origin) throw new RevisionError('Same-origin writes are required.', 403);
        if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new RevisionError('Content-Type must be application/json.', 415);
        const expected = request.headers['if-match'];
        if (!/^(0|[1-9]\d*)$/.test(expected || '')) throw new RevisionError('If-Match must contain the expected numeric version.', 428);
        const revision = await readBody(request);
        if (revision.id !== id) throw new RevisionError('URL and revision ID disagree.');
        json(200, await store.write(revision, Number(expected)));
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new RevisionError('Static content is read-only.', 405);
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (relative.split('/').some(part => part.startsWith('.'))) throw new RevisionError('Hidden paths are not served.', 403);
      const target = safeFile(store.root, relative);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new RevisionError('File not found.', 404);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
      if (request.method === 'HEAD') response.end();
      else {
        const stream = fs.createReadStream(target);
        stream.on('error', error => { console.error(`Slate static read failed: ${error.message}`); response.destroy(error); });
        stream.pipe(response);
      }
    } catch (error) {
      if (response.headersSent) { response.destroy(error); return; }
      json(error.status || 400, { error: error.message });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, store };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      if (!['--repo', '--host', '--port'].includes(args[index]) || !args[index + 1]) throw new RevisionError('Usage: serve-revisions.mjs --repo ROOT --host docs --port 8765');
      options[args[index].slice(2)] = args[index + 1];
    }
    const { origin, store } = await startRevisionServer({
      repoRoot: options.repo, host: options.host, port: options.port === undefined ? 8765 : Number(options.port),
    });
    console.log(`Slate reader and workspace revisions: ${origin}/`);
    console.log(`Revisions save automatically to ${store.revisionRoot}`);
    console.log('Loopback only. Press Ctrl+C to stop.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
