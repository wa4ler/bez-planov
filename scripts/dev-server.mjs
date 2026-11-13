import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { handleAPI } from '../functions/api/[[path]].js';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// Small D1 compatibility adapter backed by actual SQLite, used only by local tests.
export class LocalD1 {
  constructor(filename = ':memory:') { this.sqlite = new DatabaseSync(filename); }
  exec(sql) { this.sqlite.exec(sql); return Promise.resolve({ count: 1 }); }
  prepare(sql) {
    const db = this.sqlite;
    const bound = args => ({
      sql, args,
      bind(...next) { return bound(next); },
      async first(column) { const row = db.prepare(sql).get(...args); return column ? row?.[column] ?? null : row ? { ...row } : null; },
      async all() { return { results: db.prepare(sql).all(...args).map(row => ({ ...row })), success: true }; },
      async run() { const result = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; }
    });
    return bound([]);
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.sqlite.exec('COMMIT'); return results; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  close() { this.sqlite.close(); }
}

export async function createDevServer({ port = 8765, host = '127.0.0.1', testMode = false, database = ':memory:' } = {}) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('The local development server must bind to loopback.');
  const DB = new LocalD1(database);
  await DB.exec(await readFile(path.join(projectRoot, 'migrations/0001_accounts.sql'), 'utf8'));
  const env = { DB, APP_ORIGIN: '', ...(testMode ? { YANDEX_CLIENT_ID: 'local-fixture', YANDEX_CLIENT_SECRET: 'local-fixture', MAILRU_CLIENT_ID: 'local-fixture', MAILRU_CLIENT_SECRET: 'local-fixture' } : {}) };
  const codes = new Map(), tokens = new Map();
  const fakeFetch = async (url, init = {}) => {
    const target = new URL(url), params = new URLSearchParams(init.body || '');
    if (['oauth.yandex.ru', 'oauth.mail.ru'].includes(target.hostname) && target.pathname === '/token') {
      const code = params.get('code'), identity = codes.get(code); codes.delete(code);
      if (!identity) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      const token = randomBytes(32).toString('base64url'); tokens.set(token, identity);
      return Response.json({ access_token: token });
    }
    const token = init.headers?.Authorization?.replace(/^OAuth /, '') || params.get('access_token');
    const identity = tokens.get(token); tokens.delete(token);
    if (!identity) return Response.json({ error: 'invalid_token' }, { status: 401 });
    return Response.json({ id: identity.subject, sub: identity.subject, default_email: identity.email, email: identity.email });
  };
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, env.APP_ORIGIN);
      const requestHeaders = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value) requestHeaders.set(name, Array.isArray(value) ? value.join(',') : value);
      const request = new Request(url, { method: incoming.method, headers: requestHeaders, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: incoming, duplex: 'half' } : {}) });
      let response;
      if (testMode && url.pathname === '/__test/login') {
        const provider = url.searchParams.get('provider') === 'mailru' ? 'mailru' : 'yandex';
        const identity = { subject: url.searchParams.get('subject') || 'shared-pair', email: url.searchParams.get('email') || 'pair@yandex.ru' };
        const fixture = Buffer.from(JSON.stringify(identity)).toString('base64url');
        response = new Response(null, { status: 303, headers: { Location: '/api/auth/' + provider, 'Set-Cookie': `bp_test_identity=${fixture}; Path=/; HttpOnly; SameSite=Lax`, 'Cache-Control': 'no-store' } });
      } else if (testMode && url.pathname.startsWith('/__test/provider/')) {
        const provider = url.pathname.split('/').pop();
        const raw = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)bp_test_identity=([^;]+)/)?.[1];
        const identity = raw ? JSON.parse(Buffer.from(raw, 'base64url').toString()) : { subject: 'shared-pair', email: 'pair@yandex.ru' };
        const code = randomBytes(24).toString('base64url'); codes.set(code, identity);
        const callback = new URL('/api/auth/callback/' + provider, env.APP_ORIGIN);
        callback.search = new URLSearchParams({ state: url.searchParams.get('state') || '', code }).toString();
        response = Response.redirect(callback, 303);
      } else if (url.pathname.startsWith('/api/')) {
        response = await handleAPI(request, env, testMode ? { fetcher: fakeFetch } : {});
        if (testMode && response.status === 303) {
          const target = new URL(response.headers.get('Location'), env.APP_ORIGIN);
          if (['oauth.yandex.ru', 'oauth.mail.ru'].includes(target.hostname)) {
            const provider = target.hostname.includes('yandex') ? 'yandex' : 'mailru';
            response.headers.set('Location', '/__test/provider/' + provider + target.search);
          }
        }
      } else {
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const filename = path.resolve(projectRoot, '.' + relative);
        const hidden = relative.split('/').some(part => part.startsWith('.') || ['functions', 'migrations', 'scripts', 'tests', 'docs'].includes(part));
        if (!filename.startsWith(projectRoot + path.sep) || hidden) response = new Response('Not found', { status: 404 });
        else {
          try { if (!(await stat(filename)).isFile()) throw new Error(); response = new Response(await readFile(filename), { headers: { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' } }); }
          catch { response = new Response('Not found', { status: 404 }); }
        }
      }
      for (const value of response.headers.getSetCookie()) outgoing.appendHeader('Set-Cookie', value);
      outgoing.writeHead(response.status, Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie')));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(500, { 'Content-Type': 'text/plain' }); outgoing.end('Local server error'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const actualPort = server.address().port;
  env.APP_ORIGIN = `http://${host === '::1' ? '[::1]' : host}:${actualPort}`;
  return { server, env, DB, url: env.APP_ORIGIN, async close() { await new Promise(resolve => server.close(resolve)); DB.close(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const testMode = process.env.NODE_ENV === 'test' && process.env.DEV_OAUTH === '1';
  const database = process.env.LOCAL_DB || ':memory:';
  if (database !== ':memory:') await mkdir(path.dirname(database), { recursive: true });
  const app = await createDevServer({ port: Number(process.env.PORT) || 8765, host: process.env.BIND_HOST || '127.0.0.1', testMode, database });
  console.log(`Без планов: ${app.url}${testMode ? ' (isolated OAuth fixtures; no external providers)' : ''}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(); });
}
